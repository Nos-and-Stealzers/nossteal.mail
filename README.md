<h1 align="center">nossteal.mail</h1>

<p align="center">
  <b>A self-hosted email platform with a built-in AI assistant.</b><br>
  Bring your own mailboxes and your own AI — cloud or fully local.
</p>

<p align="center">
  <a href="docs/overview.md">Overview</a> ·
  <a href="docs/features.md">Features</a> ·
  <a href="docs/getting-started.md">Getting Started</a> ·
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="docs/configuration.md">Configuration</a> ·
  <a href="docs/security.md">Security</a> ·
  <a href="docs/faq.md">FAQ</a> ·
  <a href="DEPLOY.md">Deployment</a>
</p>

---

## What is this?

**nossteal.mail** is a self-hosted webmail client and mail server rolled into one,
with an AI assistant wired through the whole thing. You run it yourself, on your
own machine or server, and you stay in control of your data and credentials.

It does three things most webmail apps don't:

1. **Unifies your mail** — connect existing IMAP/SMTP accounts (Gmail, Fastmail,
   anything) *and* host mailboxes on your own domain, all in one inbox.
2. **Brings your own AI** — point it at a cloud model (Anthropic, or any
   OpenAI-compatible API) or a **fully local** model via [Ollama](https://ollama.com).
   No data leaves your machine unless you choose a cloud provider.
3. **Automates safely** — an assistant that can triage, draft, and act on mail,
   with explicit consent gates, an audit log, and a one-click emergency stop.

> **Heads up:** this is a from-scratch mail stack meant for self-hosting and
> learning. Running a mail server that actually sends and receives on the public
> internet takes a few extra steps — see [DEPLOY.md](DEPLOY.md).

## Highlights

- 📥 **Unified inbox** across external accounts and native domain mailboxes
- ✉️ **Send mail** via SMTP (external) or **direct-to-MX with DKIM signing** (native)
- 🌐 **Custom domains** with generated DKIM / SPF / DMARC records
- 🤖 **AI workspaces & chat** — Anthropic, OpenAI-compatible, or local Ollama
- 🛡️ **Automation modes** (manual / assisted / full) with consent + audit + pause
- 🔌 **Extensible** via MCP servers and installable plugins
- 🗂️ **Productivity built in** — notes, tasks, and multi-step workflows
- 🔐 **Credentials encrypted at rest** (AES-256-GCM); JWT auth; bcrypt passwords

See the full list in [docs/features.md](docs/features.md).

## Quick start (local)

**Prerequisites:** [Node.js 20+](https://nodejs.org), PostgreSQL 16, and
(optional, for local AI) [Ollama](https://ollama.com).

```bash
# 1. Install dependencies
cd server && npm install && cd ../web && npm install && cd ..

# 2. Configure the server (copy the example and fill in the blanks)
cp server/.env.example server/.env         # then edit it — see docs/configuration.md
cp web/.env.example web/.env.local

# 3. Create the database schema and an admin user
cd server
npm run migrate
SEED_ADMIN_USERNAME=you SEED_ADMIN_PASSWORD=change-me npm run seed-admin
cd ..

# 4. Start everything
cd server && npm run dev        # API on :4000
cd server && npm run mailserver # inbound SMTP on :2525 (dev)
cd web    && npm run dev        # web app on :3000
```

Then open **http://localhost:3000** and log in.

**On Windows** you can skip step 4 and just double-click **`start.bat`** — it
starts the database, all services, and opens the app. `stop.bat` shuts it down.

Full walkthrough: [docs/getting-started.md](docs/getting-started.md).

## Project layout

```
.
├── server/      Express + TypeScript API, Postgres, SMTP receiver
├── web/         Next.js 16 web client
├── docs/        Documentation (start at docs/README.md)
├── DEPLOY.md    Production / real-mail deployment guide
├── start.bat    One-click launcher (Windows)
└── docker-compose.yml   Optional Postgres + Redis for local dev
```

More detail in [docs/architecture.md](docs/architecture.md).

## Documentation

All docs live in [`docs/`](docs/README.md):

| Page | What's in it |
|------|--------------|
| [Overview](docs/overview.md) | What the project is, who it's for, core concepts |
| [Features](docs/features.md) | Everything it can do, by area |
| [Getting Started](docs/getting-started.md) | Step-by-step local setup |
| [Architecture](docs/architecture.md) | How the pieces fit together |
| [Configuration](docs/configuration.md) | Every environment variable |
| [Security](docs/security.md) | Secrets, encryption, automation safety |
| [FAQ](docs/faq.md) | Common questions & troubleshooting |
| [Deployment](DEPLOY.md) | Getting real mail working on a VPS |

## Security & secrets

**Never commit your `.env` files.** They hold your JWT secret, encryption key,
and admin credentials, and are already git-ignored. The repo ships `.env.example`
templates only. See [docs/security.md](docs/security.md) before you deploy.

## License

Released under the [MIT License](LICENSE).
