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

1. **Unifies your mail** — connect existing IMAP/SMTP accounts (Gmail, Fastmail,
   anything) *and* host mailboxes on your own domain, all in one inbox.
2. **Brings your own AI** — point it at a cloud model (Anthropic, or any
   OpenAI-compatible API) or a **fully local** model via [Ollama](https://ollama.com).
3. **Automates safely** — an assistant that can triage, draft, and act on mail,
   with explicit consent gates, an audit log, and a one-click emergency stop.

## Highlights

- 📥 **Unified inbox** with folders (Inbox / Starred / Sent), search, star, and delete
- 👤 **Instant addresses** — sign up and get `you@yourdomain` as a real, working mailbox
- 🔁 **Internal delivery** — mail between mailboxes on the same instance is delivered
  directly, with **no port 25, no relay, no public DNS** (perfect for a small group)
- 📨 **Optional external inbound** — receive mail from the outside world via a mail
  service webhook, without running your own port-25 server (see below)
- ✉️ **Send mail** via SMTP (external) or **direct-to-MX with DKIM signing** (native)
- 🌐 **Custom domains** with generated DKIM / SPF / DMARC records
- 🤖 **AI workspaces & chat** — Anthropic, OpenAI-compatible, or local Ollama
- 🧑‍🚀 **AI sub-mailboxes** — lightweight, quota-capped inboxes an assistant can own
- 🛡️ **Automation modes** (manual / assisted / full) with consent + audit + pause
- 🔌 **Extensible** via MCP servers and installable plugins
- 🗂️ **Productivity built in** — notes, tasks, and multi-step workflows
- 💾 **Per-mailbox storage quotas** with live usage; plan-based limits
- 🎟️ **Invite-only signups** (optional) with admin-generated codes
- 📇 **Address book** — pick recipients from the mailboxes on your instance
- ⚙️ **Full settings** — profile, mail, AI defaults, appearance, notifications,
  storage & plan, and security (incl. change password / delete account)
- 🎨 **Themed UI** — warm grey + burnt-orange, light & dark, with a public marketing site
- 🔐 **Credentials encrypted at rest** (AES-256-GCM); JWT auth; bcrypt passwords

## Quick start (local)

**Prerequisites:** [Node.js 20+](https://nodejs.org), PostgreSQL 16, and
(optional, for local AI) [Ollama](https://ollama.com).

```bash
# 1. Install dependencies
cd server && npm install && cd ../web && npm install && cd ..

# 2. Configure (copy the examples and fill in the blanks)
cp server/.env.example server/.env         # see docs/configuration.md
cp web/.env.example web/.env.local

# 3. Create the schema and an admin user
cd server
npm run migrate
SEED_ADMIN_USERNAME=you SEED_ADMIN_PASSWORD=change-me npm run seed-admin
cd ..

# 4. Start everything (separate terminals)
cd server && npm run dev        # API on :4000
cd server && npm run mailserver # inbound SMTP on :2525 (dev)
cd web    && npm run dev        # web app on :3000
```

Open **http://localhost:3000** and log in. Full walkthrough:
[docs/getting-started.md](docs/getting-started.md).

## Signups & addresses

Set `MAIL_DOMAIN` (server env) to a domain you've added on the Domains page, and
every new signup picks a username and gets a real mailbox at `username@MAIL_DOMAIN`
— shown live on the register screen and on their profile. Set
`REGISTRATION_MODE=invite` to require a single-use invite code (admins generate
codes on the **Admin** page).

## How mail flows

| Scenario | What happens | Needs |
|----------|--------------|-------|
| Between mailboxes on **this instance** | Delivered internally, straight into the inbox | Nothing — no port 25, no DNS |
| **Sending** to the outside world | Native: direct-to-MX + DKIM · External: your account's SMTP | Public IP on port 25 (native) or provider SMTP |
| **Receiving** from the outside world | An inbound mail service accepts it and POSTs to the app | MX + a mail service (below) |

### Receiving external mail without port 25

The app exposes an inbound webhook: `POST /api/inbound/<INBOUND_WEBHOOK_SECRET>`
(accepts JSON, form-encoded, or multipart). Point a mail service's inbound
route/parse (Mailgun, SendGrid Inbound Parse, CloudMailin, …) at that URL through
a public tunnel, add the service's MX records to your domain, and external mail
lands in the right mailbox — **no VPS or port 25 required**. Keep the secret in
`server/.env`; never commit it.

For a full public mail server on port 25 instead, see [DEPLOY.md](DEPLOY.md).

## Project layout

```
.
├── server/      Express + TypeScript API, Postgres, SMTP receiver, inbound webhook
├── web/         Next.js 16 web client (app + public marketing pages)
├── docs/        Documentation (start at docs/README.md)
├── DEPLOY.md    Production / real-mail deployment guide
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
admin credentials, `INBOUND_WEBHOOK_SECRET`, and any mail-service keys — and are
already git-ignored. The repo ships `.env.example` templates only. See
[docs/security.md](docs/security.md) before you deploy.

## License

Released under the [MIT License](LICENSE).
