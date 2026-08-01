"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type Domain } from "@/lib/api";

export default function DomainsPage() {
  const { loading } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainName, setDomainName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

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

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <Link href="/inbox" className="text-sm text-indigo-400 hover:underline">
          ← Back to inbox
        </Link>
      </header>
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-6">
        <section>
          <h1 className="mb-3 text-xl font-semibold">Domains</h1>
          <p className="mb-4 text-sm text-neutral-500">
            Adding a domain generates a DKIM keypair and gives you the DNS records to publish yourself
            (wherever your domain&apos;s DNS is hosted). Mail sent from addresses on a domain here goes direct
            to the recipient&apos;s mail server — no relay, no third party. Inbound delivery only works once
            the SMTP receiver is deployed on a host with a public IP, matching reverse DNS, and port 25 open.
          </p>
          {!domains.length ? (
            <p className="text-neutral-500">No domains added yet.</p>
          ) : (
            <ul className="space-y-4">
              {domains.map((d) => (
                <li key={d.id} className="rounded border border-neutral-800 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{d.domain_name}</p>
                    <button onClick={() => handleDelete(d.id)} className="text-red-400 hover:underline">
                      Remove
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Added {new Date(d.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-neutral-400">DNS records to publish:</p>
                    {d.dns_records.map((r, i) => (
                      <div key={i} className="rounded border border-neutral-800 bg-neutral-900 p-2 text-xs">
                        <p className="text-neutral-400">
                          <span className="font-mono text-indigo-400">{r.type}</span> · {r.host}
                        </p>
                        <p className="mt-1 break-all font-mono text-neutral-300">{r.value}</p>
                        <p className="mt-1 text-neutral-500">{r.note}</p>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Add domain</h2>
          {error && <p className="mb-3 rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              required
              placeholder="yourdomain.com"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add domain"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
