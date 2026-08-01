"use client";

import { useEffect, useState } from "react";
import { api, type Domain } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainName, setDomainName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const { domains } = await api.listDomains();
    setDomains(domains);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createDomain(domainName);
      setDomainName("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteDomain(id);
    await refresh();
  }

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  return (
    <AppShell title="Domains" maxWidth="48rem">
      <form onSubmit={handleSubmit} className="card card-pad mb-6">
        <label className="label">Add a domain you own</label>
        <div className="flex gap-2">
          <input required placeholder="yourdomain.com" value={domainName} onChange={(e) => setDomainName(e.target.value)} className="input" />
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Adding…" : "Add"}</button>
        </div>
        {error && <p className="alert alert-danger mt-3">{error}</p>}
        <p className="mt-3 text-xs subtle">
          Adding a domain generates a DKIM keypair and the DNS records to publish. Outbound mail goes
          direct to the recipient — no relay. Inbound needs the SMTP receiver deployed on a public host
          (port 25 + reverse DNS).
        </p>
      </form>

      {!domains.length ? (
        <div className="empty">No domains yet. Add one above to get your DNS records.</div>
      ) : (
        <div className="space-y-4">
          {domains.map((d) => (
            <div key={d.id} className="card card-pad">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{d.domain_name}</p>
                  <p className="text-xs subtle">Added {new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleDelete(d.id)} className="btn btn-danger btn-sm">Remove</button>
              </div>

              <p className="eyebrow mt-4 mb-2">DNS records to publish</p>
              <div className="space-y-2">
                {d.dns_records.map((r, i) => {
                  const key = `${d.id}-${i}`;
                  return (
                    <div key={i} className="rounded-lg border p-3" style={{ background: "var(--surface-2)" }}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="badge badge-accent">{r.type}</span>
                        <span className="mono text-xs muted">{r.host}</span>
                        <button onClick={() => copy(r.value, key)} className="btn btn-ghost btn-sm ml-auto">
                          {copied === key ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <p className="mono break-all text-xs" style={{ color: "var(--text)" }}>{r.value}</p>
                      <p className="mt-1 text-xs subtle">{r.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
