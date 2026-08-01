# Configuration

All configuration is via environment variables. The server reads `server/.env`;
the web app reads `web/.env.local`. Templates are provided as `.env.example` in
each folder — copy them and fill in your values.

> **Never commit real `.env` files.** They are git-ignored. See [Security](security.md).

## Server (`server/.env`)

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string. | `postgres://nossteal:nossteal@localhost:5432/nossteal_mail` |
| `JWT_SECRET` | Secret used to sign auth tokens. Use a long random value. | `openssl rand -base64 48` |
| `CREDENTIAL_ENCRYPTION_KEY` | Key used to encrypt stored secrets (mailbox passwords, API keys, DKIM private keys) at rest. **Changing it makes existing encrypted data unreadable.** | `openssl rand -base64 32` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Port the API server listens on. |
| `MAIL_SMTP_PORT` | `2525` | Port the inbound SMTP receiver listens on. Set to `25` on a public server. |

### Admin seeding (used by scripts, not the running server)

| Variable | Description |
|----------|-------------|
| `SEED_ADMIN_USERNAME` | Username for the admin created by `npm run seed-admin`. |
| `SEED_ADMIN_PASSWORD` | Password for that admin. |
| `SEED_ADMIN_EMAIL` | Optional email; defaults to `<username>@admin.local`. |

> Prefer passing these inline when you run the seed, e.g.
> `SEED_ADMIN_USERNAME=you SEED_ADMIN_PASSWORD=... npm run seed-admin`, so the
> password isn't left sitting in a file.

### Billing (optional — Stripe)

Billing endpoints only work if Stripe is configured. If you don't need paid
plans, leave these unset; the rest of the app runs normally.

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret API key. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the `/api/billing/webhook` endpoint. |

## Web (`web/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Base URL of the API server. Because it's `NEXT_PUBLIC_`, it's baked into the browser bundle — point it at your public API URL in production. |

## Notes on secrets

- `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` should be **different** random
  values, and **stable** for the life of the deployment.
- If you move the app to a new host, either **carry the same
  `CREDENTIAL_ENCRYPTION_KEY`** or re-create anything encrypted with the old one
  (mailboxes, provider API keys, domain DKIM keys). See [DEPLOY.md](../DEPLOY.md).

---

Next: [Security](security.md) · back to [docs](README.md)
