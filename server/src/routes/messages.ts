import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { sendMail } from "../services/mailSender.js";
import { sendMailDirect } from "../services/directMailSender.js";
import { findLocalMailboxes, deliverToLocalMailbox } from "../services/internalDelivery.js";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

messagesRouter.get("/", async (req: AuthedRequest, res) => {
  const folder = typeof req.query.folder === "string" ? req.query.folder : "INBOX";
  const starredOnly = req.query.starred === "1" || req.query.starred === "true";
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  // "Starred" is a cross-folder view; otherwise scope to a single folder.
  const where = starredOnly
    ? "user_id = $1 AND is_starred = TRUE AND is_deleted = FALSE"
    : "user_id = $1 AND folder = $2 AND is_deleted = FALSE";
  const params = starredOnly ? [req.userId, limit, offset] : [req.userId, folder, limit, offset];
  const limitIdx = starredOnly ? "$2 OFFSET $3" : "$3 OFFSET $4";

  const result = await pool.query(
    `SELECT id, from_address, to_addresses, subject, date_received, is_read, is_starred, has_attachments, folder
     FROM messages
     WHERE ${where}
     ORDER BY date_received DESC NULLS LAST
     LIMIT ${limitIdx}`,
    params
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

const updateMessageSchema = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

messagesRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = updateMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { isRead, isStarred } = parsed.data;
  const result = await pool.query(
    `UPDATE messages SET
       is_read = COALESCE($1, is_read),
       is_starred = COALESCE($2, is_starred),
       updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, is_read, is_starred`,
    [isRead ?? null, isStarred ?? null, req.params.id, req.userId]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Message not found" });
  res.json({ message: result.rows[0] });
});

messagesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query(
    "UPDATE messages SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  res.status(204).send();
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

  // 1. Deliver to any recipients that are mailboxes on THIS instance directly —
  //    no external SMTP, port 25, or public DNS needed. This is what makes a
  //    small self-hosted setup (e.g. you and a friend) work with zero infra.
  const allRecipients = [...body.to, ...(body.cc ?? [])];
  const localMailboxes = await findLocalMailboxes(allRecipients);
  const internal: { address: string; status: "delivered" | "over_quota" }[] = [];
  for (const [address, mailbox] of localMailboxes) {
    const status = await deliverToLocalMailbox(mailbox, {
      fromAddress: account.email_address,
      subject: body.subject,
      html: body.html,
      text: body.text,
      inReplyTo: body.inReplyTo,
    });
    internal.push({ address, status });
  }

  // 2. Anything not hosted here goes out via the normal path.
  const isLocal = (a: string) => localMailboxes.has(a.toLowerCase());
  const remoteTo = body.to.filter((a) => !isLocal(a));
  const remoteCc = (body.cc ?? []).filter((a) => !isLocal(a));

  let remote: unknown = null;
  let remoteError: string | null = null;
  let remoteSent = false;

  if (remoteTo.length || remoteCc.length) {
    try {
      if (account.account_kind === "native") {
        const domainResult = await pool.query("SELECT * FROM domains WHERE id = $1", [account.domain_id]);
        const domain = domainResult.rows[0];
        if (!domain) return res.status(500).json({ error: "Native account has no associated domain" });
        const results = await sendMailDirect({
          fromAddress: account.email_address,
          domainName: domain.domain_name,
          dkimSelector: domain.dkim_selector,
          dkimPrivateKeyEncrypted: domain.dkim_private_key_encrypted,
          to: remoteTo,
          cc: remoteCc,
          subject: body.subject,
          html: body.html,
          text: body.text,
          inReplyTo: body.inReplyTo,
        });
        remote = results;
        remoteSent = results.some((r) => r.status === "sent");
      } else {
        const info = await sendMail(account, { ...body, to: remoteTo, cc: remoteCc });
        remote = { messageId: info.messageId };
        remoteSent = true;
      }
    } catch (err) {
      remoteError = (err as Error).message;
    }
  }

  const internalDelivered = internal.some((r) => r.status === "delivered");
  const delivered = internalDelivered || remoteSent;

  // 3. Save a copy in the sender's Sent folder if anything went out.
  if (delivered) {
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

  if (!delivered && remoteError) {
    return res.status(502).json({ error: "Send failed", detail: remoteError, internal });
  }
  res.status(delivered ? 201 : 502).json({ delivered, internal, remote, remoteError });
});
