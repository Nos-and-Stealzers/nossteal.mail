"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type EmailAccountSummary, type Domain } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tab, setTab] = useState<"external" | "native">("external");
  const [form, setForm] = useState(emptyForm);
  const [nativeForm, setNativeForm] = useState({ domainId: "", localPart: "", displayName: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const [{ accounts }, { domains }] = await Promise.all([api.listAccounts(), api.listDomains()]);
    setAccounts(accounts);
    setDomains(domains);
    setNativeForm((f) => ({ ...f, domainId: f.domainId || domains[0]?.id || "" }));
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

  function update<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <AppShell title="Email accounts" maxWidth="46rem">
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Connected</h2>
        {!accounts.length ? (
          <div className="empty">No accounts connected yet. Add one below.</div>
        ) : (
          <div className="list">
            {accounts.map((a) => (
              <div key={a.id} className="list-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{a.email_address}</span>
                    <span className={`badge ${a.account_kind === "native" ? "badge-accent" : ""}`}>
                      {a.account_kind === "native" ? "native" : "external"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs subtle">
                    {a.account_kind === "external"
                      ? `IMAP ${a.imap_host} · SMTP ${a.smtp_host} · last sync ${a.last_sync ? new Date(a.last_sync).toLocaleString() : "never"}`
                      : "Receives mail directly via the inbound SMTP receiver"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Add account</h2>
        <div className="mb-4 inline-flex rounded-lg p-1" style={{ background: "var(--surface-2)" }}>
          <button onClick={() => setTab("external")} className="btn btn-sm" style={tab === "external" ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)" } : { background: "transparent", color: "var(--text-muted)" }}>
            Connect existing
          </button>
          <button onClick={() => setTab("native")} className="btn btn-sm" style={tab === "native" ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)" } : { background: "transparent", color: "var(--text-muted)" }}>
            Native mailbox
          </button>
        </div>

        {error && <p className="alert alert-danger mb-4">{error}</p>}

        {tab === "external" ? (
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
            <button type="submit" disabled={saving} className="btn btn-primary mt-5">
              {saving ? "Saving…" : "Connect account"}
            </button>
          </form>
        ) : !domains.length ? (
          <div className="alert alert-info">
            Add a domain first. <Link href="/domains" className="link">Go to domains →</Link>
          </div>
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
            <button type="submit" disabled={saving} className="btn btn-primary mt-4">
              {saving ? "Creating…" : "Create mailbox"}
            </button>
          </form>
        )}
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
