"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type MessageSummary, type EmailAccountSummary } from "@/lib/api";

export default function InboxPage() {
  const { user, loading, logout } = useAuth();
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
    }
  }

  async function syncAll() {
    setBusy(true);
    setError(null);
    try {
      for (const account of accounts) {
        await api.syncAccount(account.id);
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold">nossteal.mail</h1>
        <nav className="flex items-center gap-4 text-sm">
          <span className="text-neutral-400">{user?.email}</span>
          {user?.is_admin && (
            <Link href="/admin" className="text-emerald-400 hover:underline">
              Admin
            </Link>
          )}
          <Link href="/accounts" className="text-indigo-400 hover:underline">
            Accounts
          </Link>
          <Link href="/domains" className="text-indigo-400 hover:underline">
            Domains
          </Link>
          <Link href="/workspaces" className="text-indigo-400 hover:underline">
            AI Workspaces
          </Link>
          <Link href="/ai-providers" className="text-indigo-400 hover:underline">
            AI Providers
          </Link>
          <Link href="/mcp-servers" className="text-indigo-400 hover:underline">
            MCP Servers
          </Link>
          <Link href="/plugins" className="text-indigo-400 hover:underline">
            Plugins
          </Link>
          <Link href="/workflows" className="text-indigo-400 hover:underline">
            Workflows
          </Link>
          <Link href="/tasks" className="text-indigo-400 hover:underline">
            Tasks
          </Link>
          <Link href="/notes" className="text-indigo-400 hover:underline">
            Notes
          </Link>
          <Link href="/billing" className="text-indigo-400 hover:underline">
            Billing
          </Link>
          <Link href="/compose" className="text-indigo-400 hover:underline">
            Compose
          </Link>
          <button onClick={syncAll} disabled={busy || !accounts.length} className="text-indigo-400 hover:underline disabled:opacity-50">
            {busy ? "Syncing..." : "Sync"}
          </button>
          <button onClick={logout} className="text-neutral-400 hover:underline">
            Log out
          </button>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-6">
        {error && <p className="mb-4 rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
        {!accounts.length && (
          <p className="mb-4 rounded border border-neutral-800 p-4 text-sm text-neutral-400">
            Connect an email account to start syncing your inbox.{" "}
            <Link href="/accounts" className="text-indigo-400 hover:underline">
              Add account
            </Link>
          </p>
        )}
        {!messages.length ? (
          <p className="text-neutral-500">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
            {messages.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/messages/${m.id}`}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-neutral-900 ${
                    m.is_read ? "text-neutral-400" : "font-semibold text-neutral-100"
                  }`}
                >
                  <span className="w-1/3 truncate">{m.from_address ?? "(unknown sender)"}</span>
                  <span className="flex-1 truncate px-4">{m.subject ?? "(no subject)"}</span>
                  <span className="text-xs text-neutral-500">
                    {m.date_received ? new Date(m.date_received).toLocaleString() : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
