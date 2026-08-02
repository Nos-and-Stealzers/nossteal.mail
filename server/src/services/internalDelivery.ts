import { pool } from "../db/pool.js";

export interface LocalMailbox {
  id: string;
  user_id: string;
  email_address: string;
  storage_limit_bytes: string | number;
}

/**
 * Finds which of the given addresses are native mailboxes hosted on THIS
 * instance. Mail to these can be delivered internally — straight into the
 * recipient's inbox — without any external SMTP / port 25 / public DNS.
 * Returns a map keyed by the lower-cased address.
 */
export async function findLocalMailboxes(addresses: string[]): Promise<Map<string, LocalMailbox>> {
  const map = new Map<string, LocalMailbox>();
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  if (!unique.length) return map;

  const result = await pool.query(
    `SELECT id, user_id, email_address, storage_limit_bytes
     FROM email_accounts
     WHERE account_kind = 'native' AND LOWER(email_address) = ANY($1)`,
    [unique]
  );
  for (const row of result.rows) map.set(row.email_address.toLowerCase(), row);
  return map;
}

/**
 * Catch-all recipient for a hosted domain: the oldest real (non-AI) mailbox on
 * it. Lets external mail to any address @domain land somewhere instead of being
 * dropped when the exact mailbox doesn't exist.
 */
export async function findCatchAllForDomain(domain: string): Promise<LocalMailbox | null> {
  const { rows } = await pool.query(
    `SELECT id, user_id, email_address, storage_limit_bytes
     FROM email_accounts
     WHERE account_kind = 'native' AND LOWER(email_address) LIKE '%@' || LOWER($1)
     ORDER BY is_ai_managed ASC, created_at ASC
     LIMIT 1`,
    [domain]
  );
  return rows[0] ?? null;
}

async function isOverQuota(accountId: string, limitBytes: number): Promise<boolean> {
  if (!limitBytes || limitBytes <= 0) return false;
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(octet_length(COALESCE(body_html, '')) + octet_length(COALESCE(body_plaintext, ''))), 0) AS used
     FROM messages WHERE email_account_id = $1`,
    [accountId]
  );
  return Number(rows[0]?.used ?? 0) >= Number(limitBytes);
}

export interface InternalMessage {
  fromAddress: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  inReplyTo?: string | null;
}

/**
 * Delivers a message directly into a local mailbox's INBOX. Respects the
 * mailbox storage quota. Returns "delivered" | "over_quota".
 */
export async function deliverToLocalMailbox(
  mailbox: LocalMailbox,
  message: InternalMessage
): Promise<"delivered" | "over_quota"> {
  if (await isOverQuota(mailbox.id, Number(mailbox.storage_limit_bytes))) {
    return "over_quota";
  }
  await pool.query(
    `INSERT INTO messages (
       user_id, email_account_id, message_id, from_address, to_addresses,
       subject, date_sent, date_received, body_html, body_plaintext,
       folder, is_read, in_reply_to
     ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW(),$7,$8,'INBOX',FALSE,$9)`,
    [
      mailbox.user_id,
      mailbox.id,
      null,
      message.fromAddress,
      [mailbox.email_address],
      message.subject,
      message.html ?? null,
      message.text ?? null,
      message.inReplyTo ?? null,
    ]
  );
  return "delivered";
}
