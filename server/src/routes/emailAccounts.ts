import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { encryptSecret } from "../utils/crypto.js";
import { syncAccount } from "../services/imapSync.js";

export const emailAccountsRouter = Router();
emailAccountsRouter.use(requireAuth);

const createExternalAccountSchema = z.object({
  kind: z.literal("external").optional().default("external"),
  emailAddress: z.string().email(),
  displayName: z.string().optional(),
  imapHost: z.string(),
  imapPort: z.number().int(),
  imapSecure: z.boolean().default(true),
  imapUsername: z.string(),
  imapPassword: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  smtpSecure: z.boolean().default(true),
  smtpUsername: z.string(),
  smtpPassword: z.string(),
});

const createNativeAccountSchema = z.object({
  kind: z.literal("native"),
  domainId: z.string().uuid(),
  localPart: z
    .string()
    .min(1)
    .regex(/^[a-z0-9._-]+$/i, "Local part can only contain letters, numbers, dots, underscores, hyphens"),
  displayName: z.string().optional(),
});

emailAccountsRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, email_address, display_name, account_kind, imap_host, smtp_host, is_default, last_sync, created_at
     FROM email_accounts WHERE user_id = $1 ORDER BY created_at ASC`,
    [req.userId]
  );
  res.json({ accounts: result.rows });
});

emailAccountsRouter.post("/", async (req: AuthedRequest, res) => {
  if (req.body?.kind === "native") {
    const parsed = createNativeAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const n = parsed.data;

    const domainResult = await pool.query("SELECT domain_name FROM domains WHERE id = $1 AND user_id = $2", [
      n.domainId,
      req.userId,
    ]);
    const domain = domainResult.rows[0];
    if (!domain) return res.status(404).json({ error: "Domain not found" });

    const emailAddress = `${n.localPart.toLowerCase()}@${domain.domain_name}`;
    const result = await pool.query(
      `INSERT INTO email_accounts (user_id, email_address, display_name, account_kind, domain_id)
       VALUES ($1,$2,$3,'native',$4)
       RETURNING id, email_address, display_name, account_kind, created_at`,
      [req.userId, emailAddress, n.displayName ?? null, n.domainId]
    );
    return res.status(201).json({ account: result.rows[0] });
  }

  const parsed = createExternalAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const a = parsed.data;

  const result = await pool.query(
    `INSERT INTO email_accounts (
       user_id, email_address, display_name, account_kind,
       imap_host, imap_port, imap_secure, imap_username, imap_password_encrypted,
       smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password_encrypted
     ) VALUES ($1,$2,$3,'external',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, email_address, display_name, account_kind, created_at`,
    [
      req.userId,
      a.emailAddress,
      a.displayName ?? null,
      a.imapHost,
      a.imapPort,
      a.imapSecure,
      a.imapUsername,
      encryptSecret(a.imapPassword),
      a.smtpHost,
      a.smtpPort,
      a.smtpSecure,
      a.smtpUsername,
      encryptSecret(a.smtpPassword),
    ]
  );
  res.status(201).json({ account: result.rows[0] });
});

emailAccountsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query("DELETE FROM email_accounts WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  res.status(204).send();
});

emailAccountsRouter.post("/:id/sync", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    "SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  const account = result.rows[0];
  if (!account) return res.status(404).json({ error: "Account not found" });
  if (account.account_kind === "native") {
    return res.status(400).json({ error: "Native accounts receive mail directly — there's nothing to sync" });
  }

  try {
    const synced = await syncAccount(account);
    res.json({ synced });
  } catch (err) {
    res.status(502).json({ error: "Sync failed", detail: (err as Error).message });
  }
});
