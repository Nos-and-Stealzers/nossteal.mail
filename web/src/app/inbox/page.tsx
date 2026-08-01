"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type MessageSummary, type EmailAccountSummary } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Pen } from "@/components/icons";

export default function InboxPage() {
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setError(null);
    try {
      const [{ messages }, { accounts }] = await Promise.all([
        api.listMessages("INBOX"),
        api.listAccounts(),
      ]);
      setMessages(messages);
      setAccounts(accounts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReady(true);
    }
  }

  async function syncAll() {
    setBusy(true);
    setError(null);
    try {
      for (const account of accounts) await api.syncAccount(account.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const initials = (addr: string | null) => (addr ?? "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

  return (
    <AppShell
      title="Inbox"
      maxWidth="56rem"
      actions={
        <>
          <button onClick={syncAll} disabled={busy || !accounts.length} className="btn btn-secondary btn-sm">
            {busy ? "Syncing…" : "Sync"}
          </button>
          <Link href="/compose" className="btn btn-primary btn-sm">
            <Pen width={15} height={15} /> <span className="hidden sm:inline">Compose</span>
          </Link>
        </>
      }
    >
      {error && <p className="alert alert-danger mb-4">{error}</p>}

      {ready && !accounts.length && (
        <div className="alert alert-info mb-4">
          Connect an email account or add a domain to start receiving mail.{" "}
          <Link href="/accounts" className="link">Add account →</Link>
        </div>
      )}

      {!ready ? (
        <p className="muted">Loading…</p>
      ) : !messages.length ? (
        <div className="empty">
          <p className="mb-1 font-medium" style={{ color: "var(--text)" }}>No messages yet</p>
          <p className="text-sm">Once mail arrives or you sync an account, it shows up here.</p>
        </div>
      ) : (
        <div className="list">
          {messages.map((m) => (
            <Link key={m.id} href={`/messages/${m.id}`} className="list-row">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {initials(m.from_address)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`truncate text-sm ${m.is_read ? "muted" : "font-semibold"}`}>
                    {m.from_address ?? "(unknown sender)"}
                  </span>
                  {!m.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />}
                </div>
                <div className={`truncate text-sm ${m.is_read ? "subtle" : ""}`}>
                  {m.subject ?? "(no subject)"}
                </div>
              </div>
              <span className="shrink-0 text-xs subtle">
                {m.date_received ? new Date(m.date_received).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
