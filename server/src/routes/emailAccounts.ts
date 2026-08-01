import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { encryptSecret } from "../utils/crypto.js";
import { syncAccount } from "../services/imapSync.js";

export const emailAccountsRouter = Router();
emailAccountsRouter.use(requireAuth);

// Default per-mailbox quotas. AI sub-mailboxes are deliberately small scratch
// inboxes; regular mailboxes inherit the account's plan storage limit.
const AI_MAILBOX_LIMIT = 100 * 1024 * 1024; // 100 MB
const FALLBACK_LIMIT = 1024 * 1024 * 1024; // 1 GB

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
  isAiManaged: z.boolean().optional().default(false),
  aiProviderId: z.string().uuid().optional(),
});

// Storage limit the user's plan grants to a full mailbox.
async function planStorageLimit(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT sp.storage_limit_bytes
     FROM users u JOIN subscription_plans sp ON sp.id = u.account_type
     WHERE u.id = $1`,
    [userId]
  );
  const raw = result.rows[0]?.storage_limit_bytes;
  const value = raw != null ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_LIMIT;
}

const LIST_QUERY = `
  SELECT ea.id, ea.email_address, ea.display_name, ea.account_kind, ea.imap_host, ea.smtp_host,
         ea.is_default, ea.last_sync, ea.created_at,
         ea.storage_limit_bytes, ea.is_ai_managed, ea.ai_provider_id,
         ap.name AS ai_provider_name,
         COALESCE(used.bytes, 0) AS storage_used_bytes
  FROM email_accounts ea
  LEFT JOIN ai_providers ap ON ap.id = ea.ai_provider_id
  LEFT JOIN LATERAL (
    SELECT SUM(octet_length(COALESCE(m.body_html, '')) + octet_length(COALESCE(m.body_plaintext, ''))) AS bytes
    FROM messages m WHERE m.email_account_id = ea.id
  ) used ON TRUE
  WHERE ea.user_id = $1
  ORDER BY ea.created_at ASC`;

emailAccountsRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(LIST_QUERY, [req.userId]);
  res.json({ accounts: result.rows });
});

emailAccountsRouter.post("/", async (req: AuthedRequest, res) => {
  if (req.body?.kind === "native") {
    const parsed = createNativeAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const n = parsed.data;

    // Allow the user's own domains, or the shared signup domain (MAIL_DOMAIN).
    const domainResult = await pool.query(
      "SELECT domain_name FROM domains WHERE id = $1 AND (user_id = $2 OR LOWER(domain_name) = LOWER($3))",
      [n.domainId, req.userId, process.env.MAIL_DOMAIN?.trim() ?? ""]
    );
    const domain = domainResult.rows[0];
    if (!domain) return res.status(404).json({ error: "Domain not found" });

    if (n.aiProviderId) {
      const providerOwned = await pool.query("SELECT id FROM ai_providers WHERE id = $1 AND user_id = $2", [
        n.aiProviderId,
        req.userId,
      ]);
      if (!providerOwned.rowCount) return res.status(404).json({ error: "AI provider not found" });
    }

    const storageLimit = n.isAiManaged ? AI_MAILBOX_LIMIT : await planStorageLimit(req.userId!);
    const emailAddress = `${n.localPart.toLowerCase()}@${domain.domain_name}`;

    const inserted = await pool.query(
      `INSERT INTO email_accounts (user_id, email_address, display_name, account_kind, domain_id,
         storage_limit_bytes, is_ai_managed, ai_provider_id)
       VALUES ($1,$2,$3,'native',$4,$5,$6,$7)
       RETURNING id`,
      [req.userId, emailAddress, n.displayName ?? null, n.domainId, storageLimit, n.isAiManaged, n.aiProviderId ?? null]
    );
    const full = await pool.query(LIST_QUERY.replace("WHERE ea.user_id = $1", "WHERE ea.id = $1"), [
      inserted.rows[0].id,
    ]);
    return res.status(201).json({ account: full.rows[0] });
  }

  const parsed = createExternalAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const a = parsed.data;
  const storageLimit = await planStorageLimit(req.userId!);

  const inserted = await pool.query(
    `INSERT INTO email_accounts (
       user_id, email_address, display_name, account_kind,
       imap_host, imap_port, imap_secure, imap_username, imap_password_encrypted,
       smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password_encrypted,
       storage_limit_bytes
     ) VALUES ($1,$2,$3,'external',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
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
      storageLimit,
    ]
  );
  const full = await pool.query(LIST_QUERY.replace("WHERE ea.user_id = $1", "WHERE ea.id = $1"), [
    inserted.rows[0].id,
  ]);
  res.status(201).json({ account: full.rows[0] });
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
