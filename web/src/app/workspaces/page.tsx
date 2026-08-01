"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type Workspace, type AiProvider } from "@/lib/api";

export default function WorkspacesPage() {
  const { loading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

  async function refresh() {
    const [{ workspaces }, { providers }] = await Promise.all([
      api.listWorkspaces(),
      api.listAiProviders(),
    ]);
    setWorkspaces(workspaces);
    setProviders(providers);
    if (providers[0] && !providerId) setProviderId(providers[0].id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createWorkspace({ aiProviderId: providerId, name });
      setName("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
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
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
        <section>
          <h1 className="mb-3 text-xl font-semibold">AI workspaces</h1>
          {!providers.length ? (
            <p className="rounded border border-neutral-800 p-4 text-sm text-neutral-400">
              Connect an AI provider first.{" "}
              <Link href="/ai-providers" className="text-indigo-400 hover:underline">
                Add provider
              </Link>
            </p>
          ) : !workspaces.length ? (
            <p className="text-neutral-500">No workspaces yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
              {workspaces.map((w) => (
                <li key={w.id}>
                  <Link href={`/workspaces/${w.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-900">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-neutral-500">via {w.provider_name}</p>
                    </div>
                    <span className="text-xs text-neutral-500">{w.conversation_count} conversations</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!!providers.length && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Create workspace</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
              <div className="space-y-1">
                <label className="text-sm text-neutral-400">AI provider</label>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-neutral-400">Workspace name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create workspace"}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
