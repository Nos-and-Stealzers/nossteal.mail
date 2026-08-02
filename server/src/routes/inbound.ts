import express, { Router } from "express";
import multer from "multer";
import { simpleParser } from "mailparser";
import { findLocalMailboxes, deliverToLocalMailbox, findCatchAllForDomain } from "../services/internalDelivery.js";

export const inboundRouter = Router();

// Inbound email arrives as: raw RFC822 (our Cloudflare email worker posts this),
// multipart (Mailgun/SendGrid), urlencoded, or JSON. Parse all of them.
inboundRouter.use(express.raw({ type: ["message/rfc822", "application/octet-stream"], limit: "25mb" }));
const uploads = multer({ limits: { fileSize: 25 * 1024 * 1024 } });
inboundRouter.use(uploads.any());
inboundRouter.use(express.urlencoded({ extended: true, limit: "25mb" }));
inboundRouter.use(express.json({ limit: "25mb" }));

type Body = Record<string, unknown>;

function pick(body: Body, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

// Pull a bare address out of "Name <addr@x>" or "addr@x".
function extractAddress(input: string): string {
  const m = input.match(/<([^>]+)>/);
  return (m ? m[1] : input).trim().replace(/^mailto:/i, "");
}

// Normalize a field (string, array, or mailparser-style {value:[{address}],text})
// into a list of bare email addresses. Handles SendGrid/Mailgun (flat strings)
// and Forward Email (nested objects) alike.
/* eslint-disable @typescript-eslint/no-explicit-any */
function toAddresses(v: any): string[] {
  if (!v) return [];
  if (typeof v === "string") return v.split(",").map(extractAddress).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(toAddresses);
  if (typeof v === "object") {
    if (Array.isArray(v.value)) return v.value.map((x: any) => x?.address || x).filter(Boolean).map(extractAddress);
    if (typeof v.address === "string") return [extractAddress(v.address)];
    if (typeof v.text === "string") return v.text.split(",").map(extractAddress).filter(Boolean);
  }
  return [];
}

function firstString(...vals: any[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
    if (v && typeof v === "object" && typeof v.text === "string" && v.text.trim()) return v.text;
  }
  return undefined;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Receives external mail from an inbound email service (Mailgun inbound route,
 * SendGrid Inbound Parse forwarding JSON, etc.) and drops it into the matching
 * local mailbox — no port 25 needed. Point the service at:
 *   https://<your-public-tunnel>/api/inbound/<INBOUND_WEBHOOK_SECRET>
 * Always returns 200 for accepted-but-undeliverable so the provider doesn't
 * retry forever; returns 403 only when the secret is wrong.
 */
inboundRouter.post("/:token", async (req, res) => {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret || req.params.token !== secret) {
    return res.status(403).json({ error: "Forbidden" });
  }

  let addresses: string[];
  let rawFrom: string;
  let subject: string;
  let text: string | null;
  let html: string | null;

  if (Buffer.isBuffer(req.body)) {
    // Raw RFC822 posted by our Cloudflare email worker. The envelope recipient
    // (X-Envelope-To) is authoritative for which mailbox this belongs to.
    const parsed = await simpleParser(req.body);
    const envTo = req.header("x-envelope-to");
    addresses = envTo ? [extractAddress(envTo)] : toAddresses(parsed.to);
    rawFrom = req.header("x-envelope-from") || parsed.from?.text || "unknown@unknown";
    subject = parsed.subject || "(no subject)";
    text = parsed.text ?? null;
    html = typeof parsed.html === "string" ? parsed.html : null;
  } else {
    const body = (req.body ?? {}) as Body;
    addresses = [
      ...toAddresses(body.recipients),
      ...toAddresses(body.to),
      ...toAddresses(body.To),
      ...toAddresses(pick(body, ["recipient", "envelope_to"])),
    ].filter(Boolean);
    rawFrom = firstString(pick(body, ["from", "sender", "From"]), body.from, body.sender) ?? "unknown@unknown";
    subject = firstString(pick(body, ["subject", "Subject"]), body.subject) ?? "(no subject)";
    text = firstString(pick(body, ["text", "body-plain", "plain", "stripped-text"]), body.text) ?? null;
    html = firstString(pick(body, ["html", "body-html", "stripped-html"]), body.html) ?? null;
  }

  console.log(`[inbound] hit: recipients=${addresses.join("|")} from=${rawFrom} subject=${subject}`);

  if (!addresses.length) return res.status(200).json({ ok: true, delivered: false, reason: "No recipient parsed" });
  const mailboxes = await findLocalMailboxes(addresses);
  const message = { fromAddress: extractAddress(rawFrom), subject, html, text };

  const results: { address: string; status: string }[] = [];
  const deliveredIds = new Set<string>();

  // 1. Deliver to exact-match mailboxes.
  for (const [address, mailbox] of mailboxes) {
    const status = await deliverToLocalMailbox(mailbox, message);
    if (status === "delivered") deliveredIds.add(mailbox.id);
    results.push({ address, status });
  }

  // 2. Catch-all: any recipient without an exact mailbox on a domain we host
  //    goes to that domain's primary mailbox, so nothing is silently lost.
  const matched = new Set([...mailboxes.keys()]);
  for (const addr of addresses) {
    if (matched.has(addr.toLowerCase())) continue;
    const domain = addr.split("@")[1]?.toLowerCase();
    if (!domain) continue;
    const catchAll = await findCatchAllForDomain(domain);
    if (catchAll && !deliveredIds.has(catchAll.id)) {
      const status = await deliverToLocalMailbox(catchAll, message);
      if (status === "delivered") deliveredIds.add(catchAll.id);
      results.push({ address: `${addr} → ${catchAll.email_address} (catch-all)`, status });
    }
  }

  if (!results.length) {
    return res.status(200).json({ ok: true, delivered: false, reason: "No mailbox for this domain" });
  }
  res.status(200).json({ ok: true, delivered: results.some((r) => r.status === "delivered"), results });
});
