import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { encryptSecret } from "../utils/crypto.js";
import { generateDkimKeypair, recommendedDnsRecords } from "../services/dkim.js";

export const domainsRouter = Router();
domainsRouter.use(requireAuth);

domainsRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    "SELECT id, domain_name, dkim_selector, dkim_public_key_pem, created_at FROM domains WHERE user_id = $1 ORDER BY created_at ASC",
    [req.userId]
  );
  const domains = result.rows.map((d) => ({
    ...d,
    dns_records: recommendedDnsRecords(
      d.domain_name,
      d.dkim_selector,
      publicKeyPemToDkimTxt(d.dkim_public_key_pem)
    ),
  }));
  res.json({ domains });
});

const createDomainSchema = z.object({
  domainName: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a valid domain, e.g. example.com"),
});

domainsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createDomainSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const keypair = generateDkimKeypair();

  const result = await pool.query(
    `INSERT INTO domains (user_id, domain_name, dkim_private_key_encrypted, dkim_public_key_pem)
     VALUES ($1,$2,$3,$4)
     RETURNING id, domain_name, dkim_selector, dkim_public_key_pem, created_at`,
    [req.userId, parsed.data.domainName.toLowerCase(), encryptSecret(keypair.privateKeyPem), keypair.publicKeyPem]
  );
  const domain = result.rows[0];

  res.status(201).json({
    domain: {
      ...domain,
      dns_records: recommendedDnsRecords(domain.domain_name, domain.dkim_selector, keypair.dnsTxtValue),
    },
  });
});

domainsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query("DELETE FROM domains WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.status(204).send();
});

function publicKeyPemToDkimTxt(pem: string): string {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  return `v=DKIM1; k=rsa; p=${base64}`;
}
