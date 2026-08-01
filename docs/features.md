# Features

A tour of what nossteal.mail can do, grouped by area. Each area maps to a page in
the web app and a set of API routes under `server/src/routes/`.

## Mail

- **Unified inbox** — read mail from every connected account in one place.
- **External accounts** — connect any mailbox over **IMAP** (read) and **SMTP**
  (send): Gmail, Outlook, Fastmail, your own server, etc. Messages are synced
  into the local database; you can trigger a sync per account.
- **Native mailboxes** — host addresses on your own domain. Inbound mail is
  received by the built-in SMTP server; no external provider involved.
- **Compose & send** — rich (HTML) or plain text, with CC and in-reply-to
  threading. External mail relays through your provider's SMTP; native mail is
  delivered **directly to each recipient's MX** and **DKIM-signed**.
- **Message view** — full headers, HTML body (sanitized with DOMPurify),
  attachments flagged, read/star state.

## Domains & deliverability

- **Add a domain** — generates a 2048-bit **DKIM** keypair automatically.
- **DNS guidance** — the app shows the exact **SPF**, **DKIM**, **DMARC**, and
  **MX** records to publish, with notes on what each does.
- **Direct-to-MX sending** — outbound native mail is signed and delivered without
  a relay/smarthost. See [DEPLOY.md](../DEPLOY.md) for making this production-ready.

## AI assistant

- **Providers** — add one or more AI models: **Anthropic** (Claude) or any
  **OpenAI-compatible** endpoint, including **local Ollama**.
- **Per-provider settings** — model name, max tokens, temperature, and a system
  prompt.
- **Workspaces & conversations** — organize chats; each workspace is tied to a
  provider. Token usage is tracked per message.
- **Automation modes** — `manual` / `assisted` / `full`, with a required
  confirmation to enable full automation and an audit trail of mode changes.
- **Emergency pause / resume** — instantly stop or restart a provider's
  automation without losing its configuration.

## Extensibility

- **MCP servers** — connect [Model Context Protocol](https://modelcontextprotocol.io)
  servers to give the assistant extra tools. The app can connect, list the
  server's tools, and record invocations.
- **Plugins** — install plugins from a **manifest URL** or inline manifest,
  enable/disable them, and grant or revoke **fine-grained permissions**.

## Productivity

- **Notes** — quick notes with titles, content, and tags.
- **Tasks** — a simple to-do list with done state and optional due dates.
- **Workflows** — chain steps into an automation. Supported step types:
  - `create_task` — create a task,
  - `create_note` — create a note,
  - `send_ai_message` — send a message to an AI workspace.
  Workflows track execution history (success / partial / failed) per run.

## Accounts, billing & admin

- **Auth** — register / log in with email or username; passwords hashed with
  bcrypt; sessions via JWT.
- **Billing** — Stripe-backed subscription plans, checkout and customer-portal
  sessions, and a webhook endpoint for syncing subscription state. Optional —
  the app runs fine without Stripe configured.
- **Admin panel** — platform stats (users, messages, providers, workflows,
  domains) and user management (including granting admin).

---

See how these are wired together in [Architecture](architecture.md), or jump to
[Getting Started](getting-started.md).
