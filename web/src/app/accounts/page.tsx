"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type EmailAccountSummary, type Domain, type AiProvider } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { formatBytes, usagePercent } from "@/lib/format";

const emptyForm = {
  emailAddress: "",
  displayName: "",
  imapHost: "",
  imapPort: 993,
  imapSecure: true,
  imapUsername: "",
  imapPassword: "",
  smtpHost: "",
  smtpPort: 465,
  smtpSecure: true,
  smtpUsername: "",
  smtpPassword: "",
};

type Tab = "external" | "native" | "ai";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [tab, setTab] = useState<Tab>("external");
  const [form, setForm] = useState(emptyForm);
  const [nativeForm, setNativeForm] = useState({ domainId: "", localPart: "", displayName: "" });
  const [aiForm, setAiForm] = useState({ domainId: "", localPart: "", aiProviderId: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const [{ accounts }, { domains }, { providers }] = await Promise.all([
      api.listAccounts(),
      api.listDomains(),
      api.listAiProviders(),
    ]);
    setAccounts(accounts);
    setDomains(domains);
    setProviders(providers);
    setNativeForm((f) => ({ ...f, domainId: f.domainId || domains[0]?.id || "" }));
    setAiForm((f) => ({ ...f, domainId: f.domainId || domains[0]?.id || "", aiProviderId: f.aiProviderId || providers[0]?.id || "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createAccount(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleNativeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createNativeAccount(nativeForm);
      setNativeForm((f) => ({ ...f, localPart: "", displayName: "" }));
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createAiMailbox({
        domainId: aiForm.domainId,
        localPart: aiForm.localPart,
        aiProviderId: aiForm.aiProviderId || undefined,
      });
      setAiForm((f) => ({ ...f, localPart: "" }));
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

  function update<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "external", label: "Connect existing" },
    { id: "native", label: "Native mailbox" },
    { id: "ai", label: "AI sub-mailbox" },
  ];

  return (
    <AppShell title="Email accounts" maxWidth="46rem">
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Mailboxes</h2>
        {!accounts.length ? (
          <div className="empty">No accounts yet. Add one below.</div>
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
                        {a.is_ai_managed ? (
                          <span className="badge badge-accent">AI mailbox</span>
                        ) : (
                          <span className="badge">{a.account_kind}</span>
                        )}
                        {a.ai_provider_name && <span className="badge">{a.ai_provider_name}</span>}
                      </div>
                      <p className="mt-0.5 text-xs subtle">
                        {a.account_kind === "external"
                          ? `IMAP ${a.imap_host} · last sync ${a.last_sync ? new Date(a.last_sync).toLocaleString() : "never"}`
                          : "Receives mail directly via the inbound SMTP receiver"}
                      </p>
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Add mailbox</h2>
        <div className="mb-4 inline-flex flex-wrap gap-1 rounded-lg p-1" style={{ background: "var(--surface-2)" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="btn btn-sm" style={tab === t.id ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)" } : { background: "transparent", color: "var(--text-muted)" }}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="alert alert-danger mb-4">{error}</p>}

        {tab === "external" && (
          <form onSubmit={handleSubmit} className="card card-pad">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email address" value={form.emailAddress} onChange={(v) => update("emailAddress", v)} type="email" required />
              <Field label="Display name" value={form.displayName} onChange={(v) => update("displayName", v)} />
            </div>
            <p className="eyebrow mt-5 mb-2">Incoming (IMAP)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Host" value={form.imapHost} onChange={(v) => update("imapHost", v)} required />
              <Field label="Port" value={String(form.imapPort)} onChange={(v) => update("imapPort", Number(v))} type="number" required />
              <Field label="Username" value={form.imapUsername} onChange={(v) => update("imapUsername", v)} required />
              <Field label="Password" value={form.imapPassword} onChange={(v) => update("imapPassword", v)} type="password" required />
            </div>
            <p className="eyebrow mt-5 mb-2">Outgoing (SMTP)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Host" value={form.smtpHost} onChange={(v) => update("smtpHost", v)} required />
              <Field label="Port" value={String(form.smtpPort)} onChange={(v) => update("smtpPort", Number(v))} type="number" required />
              <Field label="Username" value={form.smtpUsername} onChange={(v) => update("smtpUsername", v)} required />
              <Field label="Password" value={form.smtpPassword} onChange={(v) => update("smtpPassword", v)} type="password" required />
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary mt-5">{saving ? "Saving…" : "Connect account"}</button>
          </form>
        )}

        {tab === "native" && (!domains.length ? (
          <div className="alert alert-info">Add a domain first. <Link href="/domains" className="link">Go to domains →</Link></div>
        ) : (
          <form onSubmit={handleNativeSubmit} className="card card-pad">
            <div className="field">
              <label className="label">Domain</label>
              <select value={nativeForm.domainId} onChange={(e) => setNativeForm((f) => ({ ...f, domainId: e.target.value }))} className="select">
                {domains.map((d) => (<option key={d.id} value={d.id}>{d.domain_name}</option>))}
              </select>
            </div>
            <div className="field">
              <label className="label">Mailbox address</label>
              <div className="flex items-center gap-2">
                <input required placeholder="you" value={nativeForm.localPart} onChange={(e) => setNativeForm((f) => ({ ...f, localPart: e.target.value }))} className="input" />
                <span className="whitespace-nowrap text-sm subtle">@{domains.find((d) => d.id === nativeForm.domainId)?.domain_name}</span>
              </div>
            </div>
            <Field label="Display name" value={nativeForm.displayName} onChange={(v) => setNativeForm((f) => ({ ...f, displayName: v }))} />
            <button type="submit" disabled={saving} className="btn btn-primary mt-4">{saving ? "Creating…" : "Create mailbox"}</button>
          </form>
        ))}

        {tab === "ai" && (!domains.length ? (
          <div className="alert alert-info">Add a domain first. <Link href="/domains" className="link">Go to domains →</Link></div>
        ) : (
          <form onSubmit={handleAiSubmit} className="card card-pad">
            <div className="alert alert-info mb-4">
              AI sub-mailboxes are lightweight scratch inboxes an assistant can own — capped at <strong>100&nbsp;MB</strong>.
              Upgrade your plan on the <Link href="/settings?tab=storage" className="link">Storage</Link> tab for more room.
            </div>
            <div className="field">
              <label className="label">Domain</label>
              <select value={aiForm.domainId} onChange={(e) => setAiForm((f) => ({ ...f, domainId: e.target.value }))} className="select">
                {domains.map((d) => (<option key={d.id} value={d.id}>{d.domain_name}</option>))}
              </select>
            </div>
            <div className="field">
              <label className="label">Mailbox address</label>
              <div className="flex items-center gap-2">
                <input required placeholder="assistant" value={aiForm.localPart} onChange={(e) => setAiForm((f) => ({ ...f, localPart: e.target.value }))} className="input" />
                <span className="whitespace-nowrap text-sm subtle">@{domains.find((d) => d.id === aiForm.domainId)?.domain_name}</span>
              </div>
            </div>
            <div className="field">
              <label className="label">Assign to AI provider <span className="subtle">(optional)</span></label>
              {providers.length ? (
                <select value={aiForm.aiProviderId} onChange={(e) => setAiForm((f) => ({ ...f, aiProviderId: e.target.value }))} className="select">
                  <option value="">— none —</option>
                  {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              ) : (
                <p className="text-sm subtle">No AI providers yet. <Link href="/ai-providers" className="link">Add one →</Link></p>
              )}
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary mt-4">{saving ? "Creating…" : "Create AI mailbox"}</button>
          </form>
        ))}
      </section>
    </AppShell>
  );
}

function Field({
  label, value, onChange, type = "text", required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  );
}
