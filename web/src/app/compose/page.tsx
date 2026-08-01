"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type EmailAccountSummary } from "@/lib/api";

export default function ComposePage() {
  const { loading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (loading) return;
    api.listAccounts().then(({ accounts }) => {
      setAccounts(accounts);
      if (accounts[0]) setAccountId(accounts[0].id);
    });
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await api.sendMessage({
        emailAccountId: accountId,
        to: to.split(",").map((s) => s.trim()).filter(Boolean),
        subject,
        text: body,
      });
      router.push("/inbox");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <Link href="/inbox" className="text-sm text-indigo-400 hover:underline">
          ← Back to inbox
        </Link>
      </header>
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 px-6 py-6">
        <h1 className="text-xl font-semibold">Compose</h1>
        {error && <p className="rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
        {!accounts.length ? (
          <p className="rounded border border-neutral-800 p-4 text-sm text-neutral-400">
            You need to connect an email account before sending.{" "}
            <Link href="/accounts" className="text-indigo-400 hover:underline">
              Add account
            </Link>
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">From</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email_address}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">To (comma separated)</label>
              <input
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Message</label>
              <textarea
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
