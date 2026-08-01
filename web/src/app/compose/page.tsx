"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type EmailAccountSummary, type DirectoryEntry } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function ComposePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.listAccounts().then(({ accounts }) => {
      setAccounts(accounts);
      if (accounts[0]) setAccountId(accounts[0].id);
    });
    api.listDirectory().then(({ entries }) => setDirectory(entries)).catch(() => {});
  }, []);

  function addRecipient(address: string) {
    const current = to.split(",").map((s) => s.trim()).filter(Boolean);
    if (current.includes(address)) return;
    setTo([...current, address].join(", "));
  }

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

  return (
    <AppShell title="Compose" maxWidth="42rem">
      {error && <p className="alert alert-danger mb-4">{error}</p>}
      {!accounts.length ? (
        <div className="alert alert-info">
          You need to connect an email account before sending.{" "}
          <Link href="/accounts" className="link">Add account →</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card card-pad">
          <div className="field">
            <label className="label">From</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="select">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.email_address}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">To <span className="subtle">(comma separated)</span></label>
            <input
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input"
              placeholder="alice@example.com, bob@example.com"
              list="directory-addresses"
            />
            <datalist id="directory-addresses">
              {directory.map((d) => (
                <option key={d.address} value={d.address}>{d.display_name ?? d.address}</option>
              ))}
            </datalist>
            {directory.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {directory.map((d) => (
                  <button key={d.address} type="button" onClick={() => addRecipient(d.address)} className="badge" style={{ cursor: "pointer" }}>
                    {d.is_ai_managed ? "🤖 " : ""}{d.address}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label className="label">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Subject" />
          </div>
          <div className="field">
            <label className="label">Message</label>
            <textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} className="textarea" placeholder="Write your message…" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={sending} className="btn btn-primary">
              {sending ? "Sending…" : "Send message"}
            </button>
            <Link href="/inbox" className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      )}
    </AppShell>
  );
}
