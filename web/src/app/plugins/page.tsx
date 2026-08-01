"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type InstalledPlugin, type PluginPermission } from "@/lib/api";

export default function PluginsPage() {
  const { loading } = useAuth();
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [manifestUrl, setManifestUrl] = useState("");
  const [manifestJson, setManifestJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

  async function refresh() {
    const { plugins } = await api.listPlugins();
    setPlugins(plugins);
  }

  async function handleInstallFromUrl(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInstalling(true);
    try {
      await api.installPluginFromUrl(manifestUrl);
      setManifestUrl("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInstalling(false);
    }
  }

  async function handleInstallFromJson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInstalling(true);
    try {
      const manifest = JSON.parse(manifestJson);
      await api.installPluginFromManifest(manifest);
      setManifestJson("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall(id: string) {
    await api.uninstallPlugin(id);
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
          <h1 className="mb-3 text-xl font-semibold">Plugins</h1>
          <p className="mb-4 text-sm text-neutral-500">
            Plugins are registered and permission-gated here, but not yet executed — a plugin can only be
            enabled once every permission it requests has been explicitly granted, and revoking any permission
            disables it again immediately.
          </p>
          {!plugins.length ? (
            <p className="text-neutral-500">No plugins installed yet.</p>
          ) : (
            <ul className="space-y-3">
              {plugins.map((p) => (
                <PluginCard key={p.id} plugin={p} onChange={refresh} onUninstall={handleUninstall} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Install from manifest URL</h2>
          <form onSubmit={handleInstallFromUrl} className="space-y-3">
            <input
              required
              type="url"
              placeholder="https://example.com/plugin.json"
              value={manifestUrl}
              onChange={(e) => setManifestUrl(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <button
              type="submit"
              disabled={installing}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {installing ? "Installing..." : "Install"}
            </button>
          </form>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Install from manifest JSON</h2>
          <form onSubmit={handleInstallFromJson} className="space-y-3">
            {error && <p className="rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
            <textarea
              rows={8}
              placeholder='{"id":"my-plugin","name":"My Plugin","version":"1.0.0","category":"productivity","permissions":["read_email"]}'
              value={manifestJson}
              onChange={(e) => setManifestJson(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs"
            />
            <button
              type="submit"
              disabled={installing}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {installing ? "Installing..." : "Install"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function PluginCard({
  plugin,
  onChange,
  onUninstall,
}: {
  plugin: InstalledPlugin;
  onChange: () => void;
  onUninstall: (id: string) => void;
}) {
  const [permissions, setPermissions] = useState<PluginPermission[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listPluginPermissions(plugin.id).then((res) => setPermissions(res.permissions));
  }, [plugin.id]);

  async function togglePermission(permission: string, granted: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (granted) await api.revokePluginPermission(plugin.id, permission);
      else await api.grantPluginPermission(plugin.id, permission);
      const res = await api.listPluginPermissions(plugin.id);
      setPermissions(res.permissions);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled() {
    setBusy(true);
    setError(null);
    try {
      await api.setPluginEnabled(plugin.id, !plugin.is_enabled);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded border border-neutral-800 px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">
            {plugin.plugin_name} <span className="text-neutral-500">v{plugin.plugin_version}</span>
          </p>
          <p className="text-neutral-500">
            {plugin.plugin_type} · {plugin.is_enabled ? "enabled" : "disabled"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleEnabled}
            disabled={busy}
            className={`rounded px-2 py-1 text-xs font-medium ${
              plugin.is_enabled ? "bg-amber-700 hover:bg-amber-600" : "bg-emerald-700 hover:bg-emerald-600"
            }`}
          >
            {plugin.is_enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={() => onUninstall(plugin.id)} className="text-red-400 hover:underline">
            Uninstall
          </button>
        </div>
      </div>
      {error && <p className="mt-2 rounded bg-red-950 p-2 text-xs text-red-300">{error}</p>}
      {permissions && permissions.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-neutral-500">Permissions</p>
          {permissions.map((p) => (
            <div key={p.permission} className="flex items-center justify-between text-xs">
              <span>{p.permission}</span>
              <button
                onClick={() => togglePermission(p.permission, p.granted)}
                disabled={busy}
                className={p.granted ? "text-emerald-400 hover:underline" : "text-neutral-500 hover:underline"}
              >
                {p.granted ? "Granted — click to revoke" : "Not granted — click to grant"}
              </button>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
