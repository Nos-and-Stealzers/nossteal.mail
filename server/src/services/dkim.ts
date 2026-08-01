import crypto from "node:crypto";

export interface DkimKeypair {
  privateKeyPem: string;
  publicKeyPem: string;
  dnsTxtValue: string;
}

export function generateDkimKeypair(): DkimKeypair {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const publicKeyBase64 = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    dnsTxtValue: `v=DKIM1; k=rsa; p=${publicKeyBase64}`,
  };
}

export function recommendedDnsRecords(domain: string, dkimSelector: string, dkimDnsTxtValue: string) {
  return [
    {
      type: "TXT",
      host: domain,
      value: "v=spf1 -all",
      note: "Base SPF: no other servers are authorized to send as this domain. Direct-send-only setup — safe default.",
    },
    {
      type: "TXT",
      host: `${dkimSelector}._domainkey.${domain}`,
      value: dkimDnsTxtValue,
      note: "DKIM public key — lets recipients verify outbound mail was actually signed by this domain.",
    },
    {
      type: "TXT",
      host: `_dmarc.${domain}`,
      value: "v=DMARC1; p=none; rua=mailto:postmaster@" + domain,
      note: "Start with p=none (report-only) while warming up; tighten to p=quarantine or p=reject once delivery is confirmed healthy.",
    },
    {
      type: "MX",
      host: domain,
      value: "10 <your inbound receiver's public hostname>",
      note: "Only needed if you want this domain to receive mail — points at wherever the SMTP receiver is deployed.",
    },
  ];
}
