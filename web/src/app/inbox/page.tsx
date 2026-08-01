"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type MessageSummary, type EmailAccountSummary } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Pen } from "@/components/icons";

type Folder = "INBOX" | "Starred" | "Sent";
const FOLDERS: { id: Folder; label: string }[] = [
  { id: "INBOX", label: "Inbox" },
  { id: "Starred", label: "Starred" },
  { id: "Sent", label: "Sent" },
];

export default function InboxPage() {
  const [folder, setFolder] = useState<Folder>("INBOX");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  async function load() {
    setError(null);
    setReady(false);
    try {
      const [{ messages }, { accounts }] = await Promise.all([
        folder === "Starred" ? api.listMessages("INBOX", true) : api.listMessages(folder),
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
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStar(m: MessageSummary, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !m.is_starred;
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, is_starred: next } : x)));
    try {
      await api.updateMessage(m.id, { isStarred: next });
      if (folder === "Starred" && !next) setMessages((list) => list.filter((x) => x.id !== m.id));
    } catch {
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, is_starred: !next } : x)));
    }
  }

  async function remove(m: MessageSummary, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMessages((list) => list.filter((x) => x.id !== m.id));
    try {
      await api.deleteMessage(m.id);
    } catch {
      load();
    }
  }

  const initials = (addr: string | null) => (addr ?? "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  const q = query.trim().toLowerCase();
  const filtered = q
    ? messages.filter((m) => (m.subject ?? "").toLowerCase().includes(q) || (m.from_address ?? "").toLowerCase().includes(q) || (m.to_addresses ?? []).join(",").toLowerCase().includes(q))
    : messages;

  return (
    <AppShell
      title="Mail"
      maxWidth="58rem"
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg p-1" style={{ background: "var(--surface-2)" }}>
          {FOLDERS.map((f) => (
            <button key={f.id} onClick={() => setFolder(f.id)} className="btn btn-sm" style={folder === f.id ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)" } : { background: "transparent", color: "var(--text-muted)" }}>
              {f.label}
            </button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail…" className="input" style={{ maxWidth: "18rem" }} />
      </div>

      {error && <p className="alert alert-danger mb-4">{error}</p>}
      {ready && !accounts.length && (
        <div className="alert alert-info mb-4">
          Connect an email account or add a domain to start receiving mail.{" "}
          <Link href="/accounts" className="link">Add account →</Link>
        </div>
      )}

      {!ready ? (
        <p className="muted">Loading…</p>
      ) : !filtered.length ? (
        <div className="empty">
          <p className="mb-1 font-medium" style={{ color: "var(--text)" }}>Nothing here</p>
          <p className="text-sm">{query ? "No messages match your search." : folder === "Sent" ? "You haven't sent anything yet." : folder === "Starred" ? "Star messages to find them here." : "New mail will appear here."}</p>
        </div>
      ) : (
        <div className="list">
          {filtered.map((m) => {
            const who = folder === "Sent" ? (m.to_addresses?.[0] ?? "(no recipient)") : (m.from_address ?? "(unknown sender)");
            return (
              <div key={m.id} className="list-row" style={{ paddingRight: "0.6rem" }}>
                <button onClick={(e) => toggleStar(m, e)} className="btn btn-ghost btn-sm" title="Star" style={{ padding: "0.3rem", color: m.is_starred ? "var(--accent)" : "var(--text-subtle)" }}>
                  {m.is_starred ? "★" : "☆"}
                </button>
                <Link href={`/messages/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    {initials(who)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm ${m.is_read || folder === "Sent" ? "muted" : "font-semibold"}`}>{who}</span>
                      {!m.is_read && folder !== "Sent" && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />}
                    </div>
                    <div className={`truncate text-sm ${m.is_read ? "subtle" : ""}`}>{m.subject ?? "(no subject)"}</div>
                  </div>
                  <span className="shrink-0 text-xs subtle">{m.date_received ? new Date(m.date_received).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
                </Link>
                <button onClick={(e) => remove(m, e)} className="btn btn-ghost btn-sm" title="Delete" style={{ padding: "0.3rem", color: "var(--text-subtle)" }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
