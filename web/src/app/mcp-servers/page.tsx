"use client";

import { useEffect, useState } from "react";
import { api, type McpServer } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function McpServersPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [name, setName] = useState("");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<Record<string, string>>({});

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const { servers } = await api.listMcpServers();
    setServers(servers);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createMcpServer({ name, connectionUrl });
      setName("");
      setConnectionUrl("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect(id: string) {
    setConnectingId(id);
    setConnectError((e) => ({ ...e, [id]: "" }));
    try {
      await api.connectMcpServer(id);
      await refresh();
    } catch (err) {
      setConnectError((e) => ({ ...e, [id]: (err as Error).message }));
    } finally {
      setConnectingId(null);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteMcpServer(id);
    await refresh();
  }

  return (
    <AppShell title="MCP servers" maxWidth="44rem">
      <p className="mb-5 text-sm muted">
        Connect remote MCP servers (Streamable HTTP) to give AI providers access to external tools.
        Nothing connects automatically — you trigger discovery and tool use explicitly.
      </p>

      {!servers.length ? (
        <div className="empty mb-8">No MCP servers connected yet.</div>
      ) : (
        <div className="mb-8 space-y-3">
          {servers.map((s) => (
            <div key={s.id} className="card card-pad">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.name}</p>
                    <span className={`badge ${s.is_connected ? "badge-success" : ""}`}>
                      {s.is_connected ? `Connected · ${s.tools_count} tools` : "Not connected"}
                    </span>
                  </div>
                  <p className="mono mt-0.5 truncate text-xs subtle">{s.connection_url}{s.server_version ? ` · ${s.server_version}` : ""}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => handleConnect(s.id)} disabled={connectingId === s.id} className="btn btn-secondary btn-sm">
                    {connectingId === s.id ? "Connecting…" : "Connect"}
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="btn btn-danger btn-sm">Remove</button>
                </div>
              </div>
              {(connectError[s.id] || (!connectError[s.id] && s.connection_error)) && (
                <p className="alert alert-danger mt-3">{connectError[s.id] || s.connection_error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Add MCP server</h2>
      <form onSubmit={handleSubmit} className="card card-pad">
        {error && <p className="alert alert-danger mb-4">{error}</p>}
        <div className="field">
          <label className="label">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div className="field">
          <label className="label">Connection URL <span className="subtle">(Streamable HTTP endpoint)</span></label>
          <input required type="url" placeholder="https://example.com/mcp" value={connectionUrl} onChange={(e) => setConnectionUrl(e.target.value)} className="input" />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Add server"}</button>
      </form>
    </AppShell>
  );
}
