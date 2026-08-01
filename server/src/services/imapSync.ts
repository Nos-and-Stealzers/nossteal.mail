import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { pool } from "../db/pool.js";
import { decryptSecret } from "../utils/crypto.js";

interface EmailAccountRow {
  id: string;
  user_id: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  imap_password_encrypted: string;
  last_uid: number;
}

export async function syncAccount(account: EmailAccountRow): Promise<number> {
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure,
    auth: {
      user: account.imap_username,
      pass: decryptSecret(account.imap_password_encrypted),
    },
    logger: false,
  });

  let syncedCount = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uidSince = account.last_uid ?? 0;
      const range = `${uidSince + 1}:*`;
      let maxUid = uidSince;

      for await (const msg of client.fetch(
        { uid: range },
        { uid: true, envelope: true, source: true, flags: true }
      )) {
        if (!msg.uid || msg.uid <= uidSince || !msg.source) continue;
        maxUid = Math.max(maxUid, msg.uid);

        const parsed = await simpleParser(msg.source);
        const toAddresses = (parsed.to && "value" in parsed.to ? parsed.to.value : []).map(
          (a) => a.address ?? ""
        );

        await pool.query(
          `INSERT INTO messages (
             user_id, email_account_id, message_id, from_address, to_addresses,
             subject, date_sent, date_received, body_html, body_plaintext,
             imap_uid, folder, is_read, has_attachments
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'INBOX',$12,$13)
           ON CONFLICT (email_account_id, folder, imap_uid) DO NOTHING`,
          [
            account.user_id,
            account.id,
            parsed.messageId ?? null,
            parsed.from?.value?.[0]?.address ?? null,
            toAddresses,
            parsed.subject ?? null,
            parsed.date ?? null,
            parsed.date ?? null,
            parsed.html || null,
            parsed.text || null,
            msg.uid,
            msg.flags?.has("\\Seen") ?? false,
            (parsed.attachments?.length ?? 0) > 0,
          ]
        );
        syncedCount++;
      }

      if (maxUid > uidSince) {
        await pool.query(
          "UPDATE email_accounts SET last_uid = $1, last_sync = NOW() WHERE id = $2",
          [maxUid, account.id]
        );
      } else {
        await pool.query("UPDATE email_accounts SET last_sync = NOW() WHERE id = $1", [
          account.id,
        ]);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return syncedCount;
}
