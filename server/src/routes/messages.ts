import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { sendMail } from "../services/mailSender.js";
import { sendMailDirect } from "../services/directMailSender.js";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

messagesRouter.get("/", async (req: AuthedRequest, res) => {
  const folder = typeof req.query.folder === "string" ? req.query.folder : "INBOX";
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const result = await pool.query(
    `SELECT id, from_address, to_addresses, subject, date_received, is_read, is_starred, has_attachments
     FROM messages
     WHERE user_id = $1 AND folder = $2 AND is_deleted = FALSE
     ORDER BY date_received DESC NULLS LAST
     LIMIT $3 OFFSET $4`,
    [req.userId, folder, limit, offset]
  );
  res.json({ messages: result.rows });
});

messagesRouter.get("/:id", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT * FROM messages WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId]
  );
  const message = result.rows[0];
  if (!message) return res.status(404).json({ error: "Message not found" });

  await pool.query("UPDATE messages SET is_read = TRUE WHERE id = $1", [message.id]);
  res.json({ message });
});

const sendSchema = z.object({
  emailAccountId: z.string().uuid(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
  inReplyTo: z.string().optional(),
});

messagesRouter.post("/send", async (req: AuthedRequest, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const body = parsed.data;

  const accountResult = await pool.query(
    "SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2",
    [body.emailAccountId, req.userId]
  );
  const account = accountResult.rows[0];
  if (!account) return res.status(404).json({ error: "Email account not found" });

  if (account.account_kind === "native") {
    const domainResult = await pool.query("SELECT * FROM domains WHERE id = $1", [account.domain_id]);
    const domain = domainResult.rows[0];
    if (!domain) return res.status(500).json({ error: "Native account has no associated domain" });

    const results = await sendMailDirect({
      fromAddress: account.email_address,
      domainName: domain.domain_name,
      dkimSelector: domain.dkim_selector,
      dkimPrivateKeyEncrypted: domain.dkim_private_key_encrypted,
      to: body.to,
      cc: body.cc,
      subject: body.subject,
      html: body.html,
      text: body.text,
      inReplyTo: body.inReplyTo,
    });

    const anySent = results.some((r) => r.status === "sent");
    if (anySent) {
      await pool.query(
        `INSERT INTO messages (
           user_id, email_account_id, message_id, from_address, to_addresses, cc_addresses,
           subject, date_sent, date_received, body_html, body_plaintext, folder, is_sent, is_read, in_reply_to
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW(),$8,$9,'Sent',TRUE,TRUE,$10)`,
        [
          req.userId,
          account.id,
          null,
          account.email_address,
          body.to,
          body.cc ?? null,
          body.subject,
          body.html ?? null,
          body.text ?? null,
          body.inReplyTo ?? null,
        ]
      );
    }

    const status = anySent ? 201 : 502;
    return res.status(status).json({ results });
  }

  try {
    const info = await sendMail(account, body);

    await pool.query(
      `INSERT INTO messages (
         user_id, email_account_id, message_id, from_address, to_addresses, cc_addresses,
         subject, date_sent, date_received, body_html, body_plaintext, folder, is_sent, is_read, in_reply_to
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW(),$8,$9,'Sent',TRUE,TRUE,$10)`,
      [
        req.userId,
        account.id,
        info.messageId ?? null,
        account.email_address,
        body.to,
        body.cc ?? null,
        body.subject,
        body.html ?? null,
        body.text ?? null,
        body.inReplyTo ?? null,
      ]
    );

    res.status(201).json({ messageId: info.messageId });
  } catch (err) {
    res.status(502).json({ error: "Send failed", detail: (err as Error).message });
  }
});
