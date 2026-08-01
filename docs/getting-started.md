# Getting Started

This walks you through running the whole stack locally. For real internet mail,
follow this first, then see [DEPLOY.md](../DEPLOY.md).

## 1. Prerequisites

- **Node.js 20+** — <https://nodejs.org>
- **PostgreSQL 16** — a local install, or run `docker-compose up -d` to get one.
- **(Optional) Ollama** — <https://ollama.com> — for a fully local AI model.

Verify Node:

```bash
node -v   # should print v20 or newer
```

## 2. Get the code

```bash
git clone <your-repo-url> nossteal.mail
cd nossteal.mail
```

## 3. Install dependencies

```bash
cd server && npm install
cd ../web && npm install
cd ..
```

## 4. Start PostgreSQL

Either use your own install, or the bundled compose file:

```bash
docker-compose up -d postgres
```

Then make sure a database and role exist that match your `DATABASE_URL`. With a
local install:

```sql
CREATE ROLE nossteal LOGIN PASSWORD 'nossteal';
CREATE DATABASE nossteal_mail OWNER nossteal;
\c nossteal_mail
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

(The compose Postgres already creates the `nossteal` role and `nossteal_mail`
database for you.)

## 5. Configure environment

Copy the templates and fill them in:

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env.local
```

Edit `server/.env`. At minimum set:

- `DATABASE_URL` — points at your Postgres.
- `JWT_SECRET` — a long random string. Generate one: `openssl rand -base64 48`.
- `CREDENTIAL_ENCRYPTION_KEY` — used to encrypt stored secrets.
  Generate one: `openssl rand -base64 32`.

Every variable is documented in [Configuration](configuration.md).

> ⚠️ Keep `.env` files private — they're git-ignored for a reason. See
> [Security](security.md).

## 6. Create the schema and an admin user

```bash
cd server
npm run migrate      # creates all tables (idempotent)

# Seed an admin. Set your own username/password:
SEED_ADMIN_USERNAME=you SEED_ADMIN_PASSWORD=choose-a-strong-one npm run seed-admin
cd ..
```

To change an admin's credentials later, run from `server/`:

```bash
npx tsx src/db/setAdmin.mjs <username> <password>
```

## 7. Run everything

Open three terminals (or use the Windows launcher below):

```bash
# Terminal 1 — API
cd server && npm run dev            # http://localhost:4000

# Terminal 2 — inbound SMTP receiver (only needed for native mail)
cd server && npm run mailserver     # port 2525 (dev)

# Terminal 3 — web app
cd web && npm run dev               # http://localhost:3000
```

Check the API is healthy:

```bash
curl http://localhost:4000/health   # -> {"status":"ok"}
```

Then open **http://localhost:3000** and log in with your seeded admin.

## 8. First things to try

1. **Add an AI provider** (AI Providers page). For local AI, choose
   *OpenAI-compatible*, endpoint `http://localhost:11434/v1`, model e.g.
   `llama3:latest`, no API key. Then start a **Workspace** and chat.
2. **Connect a mailbox** (Accounts page) with your IMAP/SMTP details, or **add a
   domain** (Domains page) and create a native mailbox.
3. **Create a task or note**, or build a **workflow**.

## Troubleshooting

- **API won't start / DB errors** — check `DATABASE_URL` and that Postgres is up
  and the `uuid-ossp` extension exists. Re-run `npm run migrate`.
- **Login fails** — re-seed or reset the admin with `setAdmin.mjs` (step 6).
- **Web can't reach API** — confirm `NEXT_PUBLIC_API_URL` in `web/.env.local`
  matches where the API is running.
- **Native inbound mail** — the dev receiver listens on 2525, which isn't
  reachable from the internet. Real mail needs port 25 on a public host —
  see [DEPLOY.md](../DEPLOY.md).

More in the [FAQ](faq.md).
