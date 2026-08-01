# Security

Self-hosting mail and an AI assistant means you hold real secrets and real
capabilities. This page covers how the app protects them and what you must do.

## Keep secrets out of the repo

The one rule that matters most: **never commit your `.env` files.**

- `server/.env` holds your `JWT_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, database
  URL, and (if you use them) admin seed credentials and Stripe keys.
- `web/.env.local` holds your API URL.

Both are already listed in [`.gitignore`](../.gitignore). The repo only ships
`.env.example` templates with placeholder values. Before pushing anywhere public,
confirm nothing sensitive is staged:

```bash
git status --ignored     # .env / .env.local should appear under "Ignored files"
git ls-files | grep -E '\.env$|\.env\.local$'   # should print nothing
```

If a secret was ever committed, rotate it — removing it from the latest commit is
not enough, since it stays in history.

## How the app protects data

- **Passwords** are hashed with **bcrypt** (cost 12) — never stored in plaintext.
- **Sessions** use **JWT** signed with `JWT_SECRET`.
- **Stored secrets** — mailbox IMAP/SMTP passwords, AI provider API keys, and
  domain **DKIM private keys** — are encrypted at rest with **AES-256-GCM**,
  keyed off `CREDENTIAL_ENCRYPTION_KEY` (see `server/src/utils/crypto.ts`). The
  database never holds them in the clear.
- **HTTP hardening** — the API uses `helmet` for secure headers.
- **HTML mail** is sanitized with **DOMPurify** before rendering.

## Choosing good secrets

- `JWT_SECRET`: `openssl rand -base64 48`
- `CREDENTIAL_ENCRYPTION_KEY`: `openssl rand -base64 32`

Use distinct values, keep them stable, and store them only in your `.env` (or a
real secrets manager in production). Losing `CREDENTIAL_ENCRYPTION_KEY` means
losing access to everything encrypted with it.

## AI automation safety

The assistant can be given authority to act on your mail. That power is gated:

- **Automation modes** — `manual` (default, no autonomous action), `assisted`
  (approved categories run without prompts), and `full` (everything you've
  permitted runs unattended).
- **Explicit consent for full automation** — switching a provider to `full`
  requires a confirmation flag; the server rejects the change without it. This
  mirrors a consent screen and is meant to be a deliberate choice.
- **Audit log** — mode changes, pauses, and resumes are written to
  `automation_action_logs` so you can review what happened.
- **Emergency pause** — instantly halts all automation for a provider without
  changing its mode, so re-enabling doesn't force you to re-confirm full
  automation.

Start in `manual`, grant only what you need, and keep the pause control in reach.

## Running a public mail server

Exposing the SMTP receiver on port 25 means accepting connections from the
internet. Before you do:

- Put it on a host you control (a VPS), not your home network.
- Set **reverse DNS (PTR)** and publish **SPF / DKIM / DMARC** — both for
  deliverability and to avoid being an abuse vector.
- Keep the OS and dependencies patched.

The full hardening/rollout steps are in [DEPLOY.md](../DEPLOY.md).

## Reporting issues

This is a self-hosted project — if you find a vulnerability, fix it in your fork
and, if the project is public, open a private report to the maintainer rather
than a public issue with exploit details.

---

Back to [docs](README.md) · [Configuration](configuration.md) · [Deployment](../DEPLOY.md)
