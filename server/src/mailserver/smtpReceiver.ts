import "dotenv/config";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { pool } from "../db/pool.js";

async function findNativeAccount(address: string) {
  const result = await pool.query(
    `SELECT id, user_id, email_address FROM email_accounts
     WHERE account_kind = 'native' AND LOWER(email_address) = LOWER($1)`,
    [address]
  );
  return result.rows[0] ?? null;
}

const server = new SMTPServer({
  banner: "nossteal.mail SMTP receiver",
  disabledCommands: ["AUTH"], // inbound receiver accepts unauthenticated mail from the internet, like any public MTA
  size: 25 * 1024 * 1024,

  async onRcptTo(address, _session, callback) {
    const account = await findNativeAccount(address.address);
    if (!account) {
      return callback(new Error("550 No such mailbox"));
    }
    callback();
  },

  async onData(stream, session, callback) {
    try {
      const parsed = await simpleParser(stream);
      const toAddresses = session.envelope.rcptTo.map((r) => r.address);

      for (const recipient of toAddresses) {
        const account = await findNativeAccount(recipient);
        if (!account) continue;

        await pool.query(
          `INSERT INTO messages (
             user_id, email_account_id, message_id, from_address, to_addresses,
             subject, date_sent, date_received, body_html, body_plaintext,
             folder, is_read, has_attachments
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,'INBOX',FALSE,$10)`,
          [
            account.user_id,
            account.id,
            parsed.messageId ?? null,
            parsed.from?.value?.[0]?.address ?? null,
            [recipient],
            parsed.subject ?? null,
            parsed.date ?? null,
            parsed.html || null,
            parsed.text || null,
            (parsed.attachments?.length ?? 0) > 0,
          ]
        );
      }

      callback();
    } catch (err) {
      callback(new Error(`450 Temporary failure processing message: ${(err as Error).message}`));
    }
  },
});

const port = Number(process.env.MAIL_SMTP_PORT) || 2525;
server.listen(port, () => {
  console.log(
    `nossteal.mail inbound SMTP receiver listening on port ${port} ` +
      (port === 25 ? "" : "(dev port — real inbound mail needs port 25 on a public IP)")
  );
});

server.on("error", (err) => {
  console.error("SMTP receiver error:", err);
});
