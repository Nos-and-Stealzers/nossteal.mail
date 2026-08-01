"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type EmailAccountSummary, type Domain } from "@/lib/api";

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
  const { loading } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tab, setTab] = useState<"external" | "native">("external");
  const [form, setForm] = useState(emptyForm);
  const [nativeForm, setNativeForm] = useState({ domainId: "", localPart: "", displayName: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

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

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <Link href="/inbox" className="text-sm text-indigo-400 hover:underline">
          ← Back to inbox
        </Link>
      </header>
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
        <section>
          <h1 className="mb-3 text-xl font-semibold">Connected accounts</h1>
          {!accounts.length ? (
            <p className="text-neutral-500">No accounts connected yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
              {accounts.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">
                    {a.email_address}{" "}
                    <span className="text-xs text-neutral-500">
                      ({a.account_kind === "native" ? "native — direct send/receive" : "external"})
                    </span>
                  </p>
                  {a.account_kind === "external" ? (
                    <p className="text-neutral-500">
                      IMAP {a.imap_host} · SMTP {a.smtp_host} · Last sync:{" "}
                      {a.last_sync ? new Date(a.last_sync).toLocaleString() : "never"}
                    </p>
                  ) : (
                    <p className="text-neutral-500">Mail arrives via the inbound SMTP receiver once deployed</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Add account</h2>
          <div className="mb-4 flex gap-2 text-sm">
            <button
              onClick={() => setTab("external")}
              className={`rounded px-3 py-1.5 ${tab === "external" ? "bg-indigo-600" : "border border-neutral-700 hover:bg-neutral-900"}`}
            >
              Connect existing account
            </button>
            <button
              onClick={() => setTab("native")}
              className={`rounded px-3 py-1.5 ${tab === "native" ? "bg-indigo-600" : "border border-neutral-700 hover:bg-neutral-900"}`}
            >
              Create native mailbox
            </button>
          </div>

          {error && <p className="mb-4 rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}

          {tab === "external" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email address" value={form.emailAddress} onChange={(v) => update("emailAddress", v)} type="email" required />
              <Field label="Display name" value={form.displayName} onChange={(v) => update("displayName", v)} />

              <div className="grid grid-cols-2 gap-4">
                <Field label="IMAP host" value={form.imapHost} onChange={(v) => update("imapHost", v)} required />
                <Field label="IMAP port" value={String(form.imapPort)} onChange={(v) => update("imapPort", Number(v))} type="number" required />
                <Field label="IMAP username" value={form.imapUsername} onChange={(v) => update("imapUsername", v)} required />
                <Field label="IMAP password" value={form.imapPassword} onChange={(v) => update("imapPassword", v)} type="password" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="SMTP host" value={form.smtpHost} onChange={(v) => update("smtpHost", v)} required />
                <Field label="SMTP port" value={String(form.smtpPort)} onChange={(v) => update("smtpPort", Number(v))} type="number" required />
                <Field label="SMTP username" value={form.smtpUsername} onChange={(v) => update("smtpUsername", v)} required />
                <Field label="SMTP password" value={form.smtpPassword} onChange={(v) => update("smtpPassword", v)} type="password" required />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Connect account"}
              </button>
            </form>
          ) : !domains.length ? (
            <p className="rounded border border-neutral-800 p-4 text-sm text-neutral-400">
              Add a domain first.{" "}
              <Link href="/domains" className="text-indigo-400 hover:underline">
                Go to domains
              </Link>
            </p>
          ) : (
            <form onSubmit={handleNativeSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-neutral-400">Domain</label>
                <select
                  value={nativeForm.domainId}
                  onChange={(e) => setNativeForm((f) => ({ ...f, domainId: e.target.value }))}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.domain_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-sm text-neutral-400">Local part</label>
                  <input
                    required
                    placeholder="lucas"
                    value={nativeForm.localPart}
                    onChange={(e) => setNativeForm((f) => ({ ...f, localPart: e.target.value }))}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                  />
                </div>
                <span className="pb-2 text-neutral-500">
                  @{domains.find((d) => d.id === nativeForm.domainId)?.domain_name}
                </span>
              </div>
              <Field
                label="Display name"
                value={nativeForm.displayName}
                onChange={(v) => setNativeForm((f) => ({ ...f, displayName: v }))}
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create mailbox"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-neutral-400">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
    </div>
  );
}
