"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type UserSettings, type EmailAccountSummary, type AiProvider, type Subscription } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { formatBytes, usagePercent } from "@/lib/format";

type Tab = "profile" | "ai" | "appearance" | "storage" | "security";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "ai", label: "AI" },
  { id: "appearance", label: "Appearance" },
  { id: "storage", label: "Storage & plan" },
  { id: "security", label: "Security" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [me, setMe] = useState<{ email: string; username: string | null; full_name: string | null; account_type?: string } | null>(null);
  const [settings, setSettings] = useState<UserSettings>({});

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (q && TABS.some((t) => t.id === q)) setTab(q);
    api.getMe().then(({ user }) => {
      setMe({ email: user.email, username: user.username, full_name: user.full_name, account_type: user.account_type });
      setSettings(user.settings ?? {});
    });
  }, []);

  return (
    <AppShell title="Settings" maxWidth="46rem">
      <div className="mb-6 flex flex-wrap gap-1 overflow-x-auto rounded-lg p-1" style={{ background: "var(--surface-2)" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn btn-sm" style={tab === t.id ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)" } : { background: "transparent", color: "var(--text-muted)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && me && <ProfileTab me={me} />}
      {tab === "ai" && <AiTab settings={settings} onSaved={setSettings} />}
      {tab === "appearance" && <AppearanceTab settings={settings} onSaved={setSettings} />}
      {tab === "storage" && <StorageTab accountType={me?.account_type} />}
      {tab === "security" && <SecurityTab />}
    </AppShell>
  );
}

function SavedNote({ show }: { show: boolean }) {
  return show ? <span className="badge badge-success ml-2">Saved</span> : null;
}

function ProfileTab({ me }: { me: { email: string; username: string | null; full_name: string | null } }) {
  const [fullName, setFullName] = useState(me.full_name ?? "");
  const [username, setUsername] = useState(me.username ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    try {
      await api.updateProfile({ fullName: fullName || null, username: username || null });
      setSaved(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="card card-pad">
      <h2 className="mb-4 font-semibold">Profile <SavedNote show={saved} /></h2>
      {error && <p className="alert alert-danger mb-4">{error}</p>}
      <div className="field">
        <label className="label">Email</label>
        <input value={me.email} disabled className="input" style={{ opacity: 0.7 }} />
      </div>
      <div className="field">
        <label className="label">Display name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder="Your name" />
      </div>
      <div className="field">
        <label className="label">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="username" />
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

function AiTab({ settings, onSaved }: { settings: UserSettings; onSaved: (s: UserSettings) => void }) {
  const [local, setLocal] = useState<UserSettings>(settings);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setLocal(settings); }, [settings]);
  useEffect(() => { api.listAiProviders().then(({ providers }) => setProviders(providers)); }, []);

  function set<K extends keyof UserSettings>(k: K, v: UserSettings[K]) { setLocal((s) => ({ ...s, [k]: v })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    try {
      const { settings } = await api.updateSettings(local);
      onSaved(settings); setSaved(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card card-pad">
        <h2 className="mb-4 font-semibold">AI defaults <SavedNote show={saved} /></h2>
        <p className="mb-4 text-sm muted">Defaults applied when you create new AI workspaces and mailboxes.</p>
        {error && <p className="alert alert-danger mb-4">{error}</p>}
        <div className="field">
          <label className="label">Default system prompt</label>
          <textarea rows={4} value={local.defaultSystemPrompt ?? ""} onChange={(e) => set("defaultSystemPrompt", e.target.value)} className="textarea" placeholder="You are a helpful email assistant…" />
        </div>
        <div className="field">
          <label className="label">AI email signature</label>
          <input value={local.aiSignature ?? ""} onChange={(e) => set("aiSignature", e.target.value)} className="input" placeholder="— Sent by my assistant" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="field">
            <label className="label">Default automation</label>
            <select value={local.defaultAutomationMode ?? "manual"} onChange={(e) => set("defaultAutomationMode", e.target.value as UserSettings["defaultAutomationMode"])} className="select">
              <option value="manual">Manual</option>
              <option value="assisted">Assisted</option>
              <option value="full">Full</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Temperature</label>
            <input type="number" step="0.1" min="0" max="2" value={local.defaultTemperature ?? 0.7} onChange={(e) => set("defaultTemperature", Number(e.target.value))} className="input" />
          </div>
          <div className="field">
            <label className="label">Max tokens</label>
            <input type="number" min="1" value={local.defaultMaxTokens ?? 2048} onChange={(e) => set("defaultMaxTokens", Number(e.target.value))} className="input" />
          </div>
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save AI defaults"}</button>
      </form>

      <div className="card card-pad">
        <h2 className="mb-3 font-semibold">Connected providers</h2>
        {!providers.length ? (
          <p className="text-sm muted">No AI providers yet. <Link href="/ai-providers" className="link">Add one →</Link></p>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name} <span className="subtle">· {p.model_name}</span></span>
                <span className="badge">{p.automation_mode}</span>
              </div>
            ))}
            <Link href="/ai-providers" className="link mt-1 inline-block text-sm">Manage providers →</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function AppearanceTab({ settings, onSaved }: { settings: UserSettings; onSaved: (s: UserSettings) => void }) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [compact, setCompact] = useState(!!settings.compactInbox);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
  }, []);
  useEffect(() => { setCompact(!!settings.compactInbox); }, [settings]);

  function applyTheme(next: "light" | "dark" | "system") {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.dataset.theme = next;
    }
  }

  async function toggleCompact() {
    const next = !compact;
    setCompact(next);
    const { settings: saved } = await api.updateSettings({ ...settings, compactInbox: next });
    onSaved(saved);
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <h2 className="mb-4 font-semibold">Theme</h2>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button key={t} onClick={() => applyTheme(t)} className={`btn ${theme === t ? "btn-primary" : "btn-secondary"}`} style={{ textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm subtle">The interface uses a warm grey base with a burnt-orange accent.</p>
      </div>

      <div className="card card-pad flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Compact inbox</h2>
          <p className="text-sm muted">Denser rows in the message list.</p>
        </div>
        <button onClick={toggleCompact} className={`btn ${compact ? "btn-primary" : "btn-secondary"}`}>{compact ? "On" : "Off"}</button>
      </div>
    </div>
  );
}

function StorageTab({ accountType }: { accountType?: string }) {
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    api.listAccounts().then(({ accounts }) => setAccounts(accounts));
    api.getSubscription().then(({ subscription }) => setSub(subscription)).catch(() => {});
  }, []);

  const totalUsed = accounts.reduce((s, a) => s + Number(a.storage_used_bytes ?? 0), 0);
  const totalLimit = accounts.reduce((s, a) => s + Number(a.storage_limit_bytes ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Plan</h2>
            <p className="text-sm muted">{sub ? `${sub.plan_name} · ${sub.subscription_status}` : (accountType ?? "free")}</p>
          </div>
          <Link href="/billing" className="btn btn-primary btn-sm">Upgrade</Link>
        </div>
        <p className="mt-3 text-sm subtle">
          Upgrading raises the storage limit on your mailboxes. AI sub-mailboxes stay lightweight (100&nbsp;MB) by design.
        </p>
      </div>

      <div className="card card-pad">
        <h2 className="mb-1 font-semibold">Storage across mailboxes</h2>
        <p className="mb-4 text-sm muted">{formatBytes(totalUsed)} used of {formatBytes(totalLimit)} allocated</p>
        {!accounts.length ? (
          <p className="text-sm subtle">No mailboxes yet.</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => {
              const pct = usagePercent(a.storage_used_bytes, a.storage_limit_bytes);
              return (
                <div key={a.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate">{a.email_address} {a.is_ai_managed && <span className="badge badge-accent ml-1">AI</span>}</span>
                    <span className="subtle">{formatBytes(a.storage_used_bytes)} / {formatBytes(a.storage_limit_bytes)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? "var(--danger)" : "var(--accent)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setOk(false);
    try {
      await api.changePassword(current, next);
      setOk(true); setCurrent(""); setNext("");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="card card-pad">
      <h2 className="mb-4 font-semibold">Change password {ok && <span className="badge badge-success ml-2">Updated</span>}</h2>
      {error && <p className="alert alert-danger mb-4">{error}</p>}
      <div className="field">
        <label className="label">Current password</label>
        <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="input" />
      </div>
      <div className="field">
        <label className="label">New password <span className="subtle">(min 8 characters)</span></label>
        <input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className="input" />
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Updating…" : "Update password"}</button>
    </form>
  );
}
