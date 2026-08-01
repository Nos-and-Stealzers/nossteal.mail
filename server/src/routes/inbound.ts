import express, { Router } from "express";
import { findLocalMailboxes, deliverToLocalMailbox } from "../services/internalDelivery.js";

export const inboundRouter = Router();

// Inbound email webhooks arrive as JSON or form-encoded, depending on the
// provider (Mailgun routes = urlencoded, generic integrations = JSON).
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
  if (mailboxes.size === 0) {
    return res.status(200).json({ ok: true, delivered: false, reason: "No matching mailbox" });
  }

  const results: { address: string; status: string }[] = [];
  for (const [address, mailbox] of mailboxes) {
    const status = await deliverToLocalMailbox(mailbox, {
      fromAddress: extractAddress(rawFrom),
      subject,
      html,
      text,
    });
    results.push({ address, status });
  }

  res.status(200).json({ ok: true, delivered: results.some((r) => r.status === "delivered"), results });
});
