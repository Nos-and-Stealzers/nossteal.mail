"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Workspace, type AiProvider } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <AppShell title="AI workspaces" maxWidth="44rem">
      {!providers.length ? (
        <div className="alert alert-info">
          Connect an AI provider first. <Link href="/ai-providers" className="link">Add provider →</Link>
        </div>
      ) : (
        <>
          {!workspaces.length ? (
            <div className="empty mb-8">No workspaces yet. Create one below to start chatting.</div>
          ) : (
            <div className="mb-8 list">
              {workspaces.map((w) => (
                <Link key={w.id} href={`/workspaces/${w.id}`} className="list-row">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{w.name}</p>
                    <p className="text-xs subtle">via {w.provider_name}</p>
                  </div>
                  <span className="badge">{w.conversation_count} chats</span>
                </Link>
              ))}
            </div>
          )}

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Create workspace</h2>
          <form onSubmit={handleSubmit} className="card card-pad">
            {error && <p className="alert alert-danger mb-4">{error}</p>}
            <div className="field">
              <label className="label">AI provider</label>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="select">
                {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <div className="field">
              <label className="label">Workspace name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Email triage" />
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Creating…" : "Create workspace"}</button>
          </form>
        </>
      )}
    </AppShell>
  );
}
