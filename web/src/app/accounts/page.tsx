"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type EmailAccountSummary, type AiProvider } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { formatBytes, usagePercent } from "@/lib/format";

type UsableDomain = { id: string; domain_name: string; is_system: boolean };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [domains, setDomains] = useState<UsableDomain[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [form, setForm] = useState({ domainId: "", localPart: "", aiProviderId: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const [{ accounts }, { domains }, { providers }] = await Promise.all([
      api.listAccounts(),
      api.listUsableDomains(),
      api.listAiProviders(),
    ]);
    setAccounts(accounts);
    setDomains(domains);
    setProviders(providers);
    setForm((f) => ({ ...f, domainId: f.domainId || domains[0]?.id || "", aiProviderId: f.aiProviderId || providers[0]?.id || "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createAiMailbox({
        domainId: form.domainId,
        localPart: form.localPart,
        aiProviderId: form.aiProviderId || undefined,
      });
      setForm((f) => ({ ...f, localPart: "" }));
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteAccount(id);
    await refresh();
  }

  const domainName = domains.find((d) => d.id === form.domainId)?.domain_name;

  return (
    <AppShell title="Mailboxes" maxWidth="46rem">
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Your mailboxes</h2>
        {!accounts.length ? (
          <div className="empty">No mailboxes yet.</div>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => {
              const pct = usagePercent(a.storage_used_bytes, a.storage_limit_bytes);
              return (
                <div key={a.id} className="card card-pad">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{a.email_address}</span>
                        {a.is_ai_managed && <span className="badge badge-accent">AI</span>}
                        {a.ai_provider_name && <span className="badge">{a.ai_provider_name}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(a.id)} className="btn btn-danger btn-sm shrink-0">Remove</button>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs subtle">
                      <span>{formatBytes(a.storage_used_bytes)} of {formatBytes(a.storage_limit_bytes)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? "var(--danger)" : "var(--accent)" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">New AI mailbox</h2>
        {error && <p className="alert alert-danger mb-4">{error}</p>}
        {!domains.length ? (
          <div className="empty">No domain available yet. Ask an admin to set one up.</div>
        ) : (
          <form onSubmit={handleSubmit} className="card card-pad">
            <div className="alert alert-info mb-4">
              A lightweight scratch inbox an assistant can own — capped at <strong>100&nbsp;MB</strong>. Upgrade your
              plan on the <Link href="/settings?tab=storage" className="link">Storage</Link> tab for more room.
            </div>
            {domains.length > 1 && (
              <div className="field">
                <label className="label">Domain</label>
                <select value={form.domainId} onChange={(e) => setForm((f) => ({ ...f, domainId: e.target.value }))} className="select">
                  {domains.map((d) => (<option key={d.id} value={d.id}>{d.domain_name}</option>))}
                </select>
              </div>
            )}
            <div className="field">
              <label className="label">Address</label>
              <div className="flex items-center gap-2">
                <input required placeholder="assistant" value={form.localPart} onChange={(e) => setForm((f) => ({ ...f, localPart: e.target.value }))} className="input" />
                <span className="whitespace-nowrap text-sm subtle">@{domainName}</span>
              </div>
            </div>
            <div className="field">
              <label className="label">Assign to AI provider <span className="subtle">(optional)</span></label>
              {providers.length ? (
                <select value={form.aiProviderId} onChange={(e) => setForm((f) => ({ ...f, aiProviderId: e.target.value }))} className="select">
                  <option value="">— none —</option>
                  {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              ) : (
                <p className="text-sm subtle">No AI providers yet. <Link href="/ai-providers" className="link">Add one →</Link></p>
              )}
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary mt-1">{saving ? "Creating…" : "Create AI mailbox"}</button>
          </form>
        )}
      </section>
    </AppShell>
  );
}
