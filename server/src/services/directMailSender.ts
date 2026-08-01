import dns from "node:dns/promises";
import nodemailer from "nodemailer";
import { decryptSecret } from "../utils/crypto.js";

export interface NativeSendParams {
  fromAddress: string;
  domainName: string;
  dkimSelector: string;
  dkimPrivateKeyEncrypted: string;
  to: string[];
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string;
}

export interface DomainSendResult {
  domain: string;
  recipients: string[];
  status: "sent" | "error";
  mxHost?: string;
  error?: string;
}

function groupRecipientsByDomain(addresses: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const address of addresses) {
    const domain = address.split("@")[1]?.toLowerCase();
    if (!domain) continue;
    const list = groups.get(domain) ?? [];
    list.push(address);
    groups.set(domain, list);
  }
  return groups;
}

async function resolveMxHosts(domain: string): Promise<string[]> {
  try {
    const records = await dns.resolveMx(domain);
    return records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
  } catch {
    // No MX record — RFC 5321 fallback is to try the domain's A/AAAA record directly.
    return [domain];
  }
}

/**
 * Sends a message by connecting directly to each recipient domain's MX host —
 * no relay/smarthost involved. Groups recipients by domain since each domain
 * may resolve to a different mail server. Best-effort: continues to the next
 * MX host in priority order if one connection fails, and continues to the next
 * domain group if a whole domain fails (reported per-domain, not thrown).
 */
export async function sendMailDirect(params: NativeSendParams): Promise<DomainSendResult[]> {
  const privateKey = decryptSecret(params.dkimPrivateKeyEncrypted);
  const allRecipients = [...params.to, ...(params.cc ?? [])];
  const domainGroups = groupRecipientsByDomain(allRecipients);

  const results: DomainSendResult[] = [];

  for (const [domain, recipients] of domainGroups) {
    const mxHosts = await resolveMxHosts(domain);
    let lastError: string | null = null;
    let sent = false;

    for (const mxHost of mxHosts) {
      try {
        const transporter = nodemailer.createTransport({
          host: mxHost,
          port: 25,
          secure: false,
          tls: { rejectUnauthorized: false },
          dkim: {
            domainName: params.domainName,
            keySelector: params.dkimSelector,
            privateKey,
          },
        });

        await transporter.sendMail({
          from: params.fromAddress,
          to: recipients,
          subject: params.subject,
          html: params.html,
          text: params.text,
          inReplyTo: params.inReplyTo,
        });

        results.push({ domain, recipients, status: "sent", mxHost });
        sent = true;
        break;
      } catch (err) {
        lastError = (err as Error).message;
      }
    }

    if (!sent) {
      results.push({ domain, recipients, status: "error", error: lastError ?? "No MX host reachable" });
    }
  }

  return results;
}
