import express, { Router } from "express";
import multer from "multer";
import { findLocalMailboxes, deliverToLocalMailbox, findCatchAllForDomain } from "../services/internalDelivery.js";

export const inboundRouter = Router();

// Inbound email webhooks arrive as multipart (Mailgun/SendGrid with fields and
// attachments), urlencoded, or JSON depending on the provider. Parse all three.
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

  const body = (req.body ?? {}) as Body;
  const rawTo = pick(body, ["to", "recipient", "To", "envelope_to"]);
  const rawFrom = pick(body, ["from", "sender", "From"]) ?? "unknown@unknown";
  const subject = pick(body, ["subject", "Subject"]) ?? "(no subject)";
  const text = pick(body, ["text", "body-plain", "plain", "stripped-text", "email"]) ?? null;
  const html = pick(body, ["html", "body-html", "stripped-html"]) ?? null;

  if (!rawTo) return res.status(400).json({ error: "Missing recipient" });

  const addresses = rawTo.split(",").map(extractAddress).filter(Boolean);
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
