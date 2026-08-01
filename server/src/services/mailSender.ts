import nodemailer from "nodemailer";
import { decryptSecret } from "../utils/crypto.js";

interface EmailAccountRow {
  email_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password_encrypted: string;
}

export async function sendMail(
  account: EmailAccountRow,
  message: { to: string[]; cc?: string[]; subject: string; html?: string; text?: string; inReplyTo?: string }
) {
  const transporter = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure,
    auth: {
      user: account.smtp_username,
      pass: decryptSecret(account.smtp_password_encrypted),
    },
  });

  return transporter.sendMail({
    from: account.email_address,
    to: message.to,
    cc: message.cc,
    subject: message.subject,
    html: message.html,
    text: message.text,
    inReplyTo: message.inReplyTo,
  });
}
