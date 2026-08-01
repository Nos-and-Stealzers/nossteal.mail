# FAQ & Troubleshooting

## General

**What is nossteal.mail, in one line?**
A self-hosted webmail client + mail server with a built-in AI assistant you can
run entirely on your own hardware (including a local AI model).

**Do I have to use the AI features?**
No. Mail, notes, tasks, and workflows all work without any AI provider
configured. Add a provider only when you want the assistant.

**Does my mail or data go to the cloud?**
Only if you choose a cloud AI provider (e.g. Anthropic) or connect an external
mailbox (whose provider already has that mail). With a **local Ollama** provider
and native domain mailboxes, nothing leaves your machine.

**Is it production-ready?**
It's a self-hosting / learning project. It works, but running real internet mail
needs the deliverability setup in [DEPLOY.md](../DEPLOY.md). Review
[Security](security.md) before exposing anything publicly.

## Setup

**Which Node version?**
Node 20 or newer.

**Do I need Docker?**
No — it's just a convenient way to get PostgreSQL. `docker-compose.yml` provides
Postgres (and a Redis container the app doesn't currently use). A local Postgres
install works equally well.

**Migration fails with `uuid-ossp` errors.**
The schema needs the `uuid-ossp` extension. Create it once as a superuser:
`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` in your database, then re-run
`npm run migrate`.

**I forgot / want to change the admin password.**
From `server/`: `npx tsx src/db/setAdmin.mjs <username> <password>`. It updates
the existing admin in place so your data stays attached.

**The web app can't reach the API.**
Check `NEXT_PUBLIC_API_URL` in `web/.env.local` matches where the API runs
(default `http://localhost:4000`). Restart `npm run dev` after changing it.

## AI

**How do I use a local model?**
Install [Ollama](https://ollama.com), pull a model (`ollama pull llama3`), then
add an **OpenAI-compatible** provider with endpoint `http://localhost:11434/v1`,
model name e.g. `llama3:latest`, and no API key.

**Can I use Claude / OpenAI?**
Yes. Choose **Anthropic** for Claude (needs an Anthropic API key), or
**OpenAI-compatible** with the appropriate endpoint and key for others.

**What does "full automation" do, and is it safe?**
It lets the assistant act unattended within the permissions you've granted.
Enabling it requires explicit confirmation and is logged, and you can pause it
instantly. Details in [Security](security.md).

## Mail

**Why won't native mail send/receive from my laptop?**
Home ISPs almost always block port 25, and receiving needs a public host with an
MX record pointing at it. Use a VPS — see [DEPLOY.md](../DEPLOY.md).

**My mail lands in spam.**
Usually missing **reverse DNS (PTR)** or misaligned **SPF/DKIM/DMARC**. Fix PTR
first, then verify your DNS records. Test with <https://www.mail-tester.com>.

**"550 No such mailbox" when receiving.**
Create the native mailbox in the app for that exact address (the local part is
case-insensitive).

**Can external accounts (Gmail) work?**
Yes — add an **external** account with your IMAP and SMTP settings. For Gmail
you'll typically need an app password.

## Contributing / hosting on GitHub

**How do I put this on GitHub safely?**
Make sure `.env` and `.env.local` are **not** tracked (they're git-ignored by
default). Run `git ls-files | grep -E '\.env'` — it should print nothing. The
committed `.env.example` files are safe placeholders. See [Security](security.md).

---

Back to [docs](README.md).
