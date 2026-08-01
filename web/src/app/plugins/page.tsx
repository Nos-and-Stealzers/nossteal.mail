"use client";

import { useEffect, useState } from "react";
import { api, type InstalledPlugin, type PluginPermission } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [manifestUrl, setManifestUrl] = useState("");
  const [manifestJson, setManifestJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

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

  return (
    <AppShell title="Plugins" maxWidth="44rem">
      <p className="mb-5 text-sm muted">
        Plugins are registered and permission-gated here. A plugin can only be enabled once every
        permission it requests has been granted — revoking any permission disables it immediately.
      </p>

      {!plugins.length ? (
        <div className="empty mb-8">No plugins installed yet.</div>
      ) : (
        <div className="mb-8 space-y-3">
          {plugins.map((p) => (
            <PluginCard key={p.id} plugin={p} onChange={refresh} onUninstall={handleUninstall} />
          ))}
        </div>
      )}

      <div className="grid gap-4">
        <form onSubmit={handleInstallFromUrl} className="card card-pad">
          <label className="label">Install from manifest URL</label>
          <div className="flex gap-2">
            <input required type="url" placeholder="https://example.com/plugin.json" value={manifestUrl} onChange={(e) => setManifestUrl(e.target.value)} className="input" />
            <button type="submit" disabled={installing} className="btn btn-primary">{installing ? "…" : "Install"}</button>
          </div>
        </form>

        <form onSubmit={handleInstallFromJson} className="card card-pad">
          <label className="label">Install from manifest JSON</label>
          {error && <p className="alert alert-danger mb-3">{error}</p>}
          <textarea rows={7} placeholder='{"id":"my-plugin","name":"My Plugin","version":"1.0.0","category":"productivity","permissions":["read_email"]}' value={manifestJson} onChange={(e) => setManifestJson(e.target.value)} className="textarea mono text-xs" />
          <button type="submit" disabled={installing} className="btn btn-primary mt-3">{installing ? "Installing…" : "Install"}</button>
        </form>
      </div>
    </AppShell>
  );
}

function PluginCard({
  plugin, onChange, onUninstall,
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
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{plugin.plugin_name}</p>
            <span className="subtle text-xs">v{plugin.plugin_version}</span>
            <span className={`badge ${plugin.is_enabled ? "badge-success" : ""}`}>{plugin.is_enabled ? "enabled" : "disabled"}</span>
          </div>
          <p className="text-xs subtle">{plugin.plugin_type}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={toggleEnabled} disabled={busy} className="btn btn-secondary btn-sm">{plugin.is_enabled ? "Disable" : "Enable"}</button>
          <button onClick={() => onUninstall(plugin.id)} className="btn btn-danger btn-sm">Uninstall</button>
        </div>
      </div>
      {error && <p className="alert alert-danger mt-3">{error}</p>}
      {permissions && permissions.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="eyebrow mb-2">Permissions</p>
          <div className="space-y-1.5">
            {permissions.map((p) => (
              <div key={p.permission} className="flex items-center justify-between text-sm">
                <span className="mono text-xs">{p.permission}</span>
                <button onClick={() => togglePermission(p.permission, p.granted)} disabled={busy} className="btn btn-ghost btn-sm" style={{ color: p.granted ? "var(--success)" : "var(--text-muted)" }}>
                  {p.granted ? "Granted · revoke" : "Grant"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
