# Architecture

nossteal.mail is a small, readable stack: a TypeScript API, a Next.js web client,
a PostgreSQL database, and a standalone SMTP receiver for inbound mail.

## The pieces

```
                    ┌─────────────────────────┐
   Browser  ───────▶│  web/  (Next.js 16)     │   http://localhost:3000
                    │  React 19 UI            │
                    └───────────┬─────────────┘
                                │  fetch (NEXT_PUBLIC_API_URL)
                                ▼
                    ┌─────────────────────────┐
                    │  server/ (Express API)  │   http://localhost:4000
                    │  JWT auth, REST routes  │
                    └───┬───────────┬─────────┘
                        │           │
          ┌─────────────┘           └──────────────┐
          ▼                                         ▼
  ┌───────────────┐                        ┌──────────────────┐
  │  PostgreSQL   │                        │  External world  │
  │  (all data)   │                        │  IMAP / SMTP /   │
  └───────▲───────┘                        │  AI APIs / MX    │
          │                                └──────────────────┘
          │
  ┌───────┴──────────────┐
  │  mailserver (SMTP)   │   port 25 (prod) / 2525 (dev)
  │  receives inbound    │
  │  mail → DB           │
  └──────────────────────┘
```

## Server (`server/`)

Express + TypeScript, run with `tsx` in dev and compiled with `tsc` for prod.

- **`src/index.ts`** — app entry: sets up Helmet, CORS, JSON parsing, mounts all
  routers, and exposes `GET /health`.
- **`src/routes/`** — one router per feature area: `auth`, `emailAccounts`,
  `messages`, `aiProviders`, `workspaces` (+ conversations), `mcpServers`,
  `plugins`, `notes`, `tasks`, `workflows`, `billing`, `billingWebhook`,
  `domains`, `admin`.
- **`src/services/`** — the real work: `aiProviders` (Anthropic +
  OpenAI-compatible chat), `directMailSender` (direct-to-MX + DKIM), `dkim`
  (keypair + DNS records), `imapSync`, `mailSender`, `mcpClient`,
  `pluginManifest`, `workflowEngine`, `billing`.
- **`src/middleware/auth.ts`** — JWT verification; attaches `userId` to requests.
- **`src/utils/crypto.ts`** — AES-256-GCM encrypt/decrypt for secrets at rest.
- **`src/db/`** — `pool.ts` (pg pool), `schema.sql` (the full schema),
  `migrate.ts`, `seedAdmin.ts`, and `setAdmin.mjs` (rotate an admin in place).
- **`src/mailserver/smtpReceiver.ts`** — a standalone SMTP server (via
  `smtp-server`) that accepts inbound mail for native mailboxes and writes it to
  the database. Runs as its own process.

### Request flow (example: send native mail)

1. Web calls `POST /api/messages/send` with a JWT.
2. `auth` middleware verifies the token → `userId`.
3. The `messages` route loads the account/domain, decrypts the DKIM private key,
   and calls `directMailSender`.
4. `directMailSender` groups recipients by domain, resolves each domain's **MX**,
   and delivers over SMTP on port 25, **DKIM-signed** — reporting success or
   failure per domain.

## Web (`web/`)

Next.js 16 (App Router, Turbopack) with React 19 and Tailwind CSS 4.

- **`src/app/`** — one route per page: `login`, `register`, `inbox`, `compose`,
  `messages/[id]`, `accounts`, `domains`, `ai-providers`, `workspaces` (+ nested
  conversation pages), `mcp-servers`, `plugins`, `notes`, `tasks`, `workflows`,
  `billing`, `admin`.
- **`src/lib/api.ts`** — a typed client for every API endpoint; reads the base
  URL from `NEXT_PUBLIC_API_URL` and attaches the JWT from `localStorage`.
- **`src/lib/useAuth.ts`** — auth hook for the client.

> **Note:** this project pins a specific Next.js version whose conventions may
> differ from older releases. See `web/AGENTS.md`.

## Database (PostgreSQL)

A single Postgres database holds everything: users, email accounts, message
threads and messages, attachments, AI providers, workspaces, conversations and
messages, automation logs, MCP servers/tools/invocations, plugins and
permissions, notes, tasks, workflows and executions, subscription plans, billing
events, and domains. The full DDL is in
[`server/src/db/schema.sql`](../server/src/db/schema.sql); it uses the
`uuid-ossp` extension for UUID primary keys and is idempotent (safe to re-run).

## Processes & ports

| Process | Command | Default port |
|---------|---------|--------------|
| API server | `npm run dev` (or `npm start` in prod) | 4000 |
| Inbound SMTP receiver | `npm run mailserver` | 2525 dev / 25 prod |
| Web app | `npm run dev` (or `npm start`) | 3000 |
| PostgreSQL | your install / `docker-compose up` | 5432 |

`docker-compose.yml` provides Postgres (and a Redis container that the app does
not currently use) for convenient local dev.

---

Next: [Configuration](configuration.md) · [Security](security.md)
