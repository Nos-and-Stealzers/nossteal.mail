# Overview

## What nossteal.mail is

nossteal.mail is a **self-hosted email platform**. It combines three things that
usually live in separate products:

- a **webmail client** (read, search, compose, organize your mail),
- a **mail server** (host mailboxes on your own domain, send and receive), and
- an **AI assistant** wired through your mail, notes, and tasks.

You host it yourself. Your mail, your credentials, and — if you want — your AI
model all stay on infrastructure you control.

## Who it's for

- People who want **one inbox** for several email accounts *plus* addresses on
  their own domain.
- Anyone who wants an **AI email assistant** without handing their mailbox to a
  third-party SaaS — including running the model **fully locally**.
- Tinkerers and self-hosters who want to understand how email actually works
  (IMAP, SMTP, DKIM/SPF/DMARC) with a real, working codebase.

## Core concepts

Understanding these five ideas is enough to use the whole app.

### 1. Accounts (mailboxes)

An **email account** is a mailbox in your inbox. There are two kinds:

- **External** — an existing mailbox elsewhere (Gmail, Fastmail, your work mail).
  You provide IMAP settings (to read) and SMTP settings (to send). nossteal.mail
  syncs messages in and relays outbound mail through your provider.
- **Native** — a mailbox on a **domain you've added** to nossteal.mail (e.g.
  `you@yourdomain.com`). These are hosted *by* nossteal.mail: inbound mail is
  received by its SMTP server, and outbound mail is sent directly and DKIM-signed.

### 2. Domains

A **domain** you own and register in the app. When you add one, nossteal.mail
generates a **DKIM keypair** and shows you the exact **DNS records** (SPF, DKIM,
DMARC, MX) to publish. Once DNS is set, you can create native mailboxes under it.
See [DEPLOY.md](../DEPLOY.md) for taking a domain live.

### 3. AI providers

An **AI provider** is a model the assistant uses. Two types:

- **Anthropic** — Claude models via the Anthropic API (needs an API key).
- **OpenAI-compatible** — any endpoint that speaks the OpenAI chat API. This
  covers OpenAI itself, many gateways, and **local models via Ollama**
  (`http://localhost:11434/v1`, no key required).

Your API keys are **encrypted at rest**.

### 4. Workspaces & conversations

A **workspace** groups conversations against a chosen AI provider. A
**conversation** is a chat thread. This is where you talk to the assistant —
ask it to summarize a thread, draft a reply, or reason over your mail.

### 5. Automation modes

Each provider has an **automation mode** that controls how much the assistant may
do on its own:

- **manual** — the assistant only acts when you tell it to (default).
- **assisted** — approved categories of action run without a per-action prompt.
- **full** — everything you've permitted runs unattended. Turning this on
  requires an **explicit confirmation** and is recorded in an audit log.

There's also an **emergency pause** that instantly halts all automation for a
provider without changing its mode. More in [Security](security.md).

## What else is in the box

Beyond mail and AI, the app includes **notes**, **tasks**, and **workflows**
(multi-step automations), an **MCP server** integration and a **plugin** system
for extending the assistant, plus **billing** (Stripe subscription plans) and an
**admin** panel. See [Features](features.md) for the full tour.

---

Next: [Getting Started](getting-started.md) · [Features](features.md) · [Architecture](architecture.md)
