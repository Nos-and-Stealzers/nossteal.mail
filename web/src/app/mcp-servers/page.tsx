"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type McpServer } from "@/lib/api";

export default function McpServersPage() {
  const { loading } = useAuth();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [name, setName] = useState("");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

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
          <h1 className="mb-3 text-xl font-semibold">MCP servers</h1>
          <p className="mb-4 text-sm text-neutral-500">
            Connect remote MCP servers (Streamable HTTP) to give AI providers access to external tools. Nothing
            connects automatically — you trigger discovery and tool use explicitly.
          </p>
          {!servers.length ? (
            <p className="text-neutral-500">No MCP servers connected yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
              {servers.map((s) => (
                <li key={s.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-neutral-500">{s.connection_url}</p>
                      <p className="text-xs text-neutral-600">
                        {s.is_connected ? `Connected · ${s.tools_count} tools` : "Not connected"}
                        {s.server_version ? ` · ${s.server_version}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleConnect(s.id)}
                        disabled={connectingId === s.id}
                        className="text-indigo-400 hover:underline disabled:opacity-50"
                      >
                        {connectingId === s.id ? "Connecting..." : "Connect / refresh"}
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                  {connectError[s.id] && (
                    <p className="mt-2 rounded bg-red-950 p-2 text-xs text-red-300">{connectError[s.id]}</p>
                  )}
                  {!connectError[s.id] && s.connection_error && (
                    <p className="mt-2 rounded bg-red-950 p-2 text-xs text-red-300">{s.connection_error}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Add MCP server</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Connection URL (Streamable HTTP endpoint)</label>
              <input
                required
                type="url"
                placeholder="https://example.com/mcp"
                value={connectionUrl}
                onChange={(e) => setConnectionUrl(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add server"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
