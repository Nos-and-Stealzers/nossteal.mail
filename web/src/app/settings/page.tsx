"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type UserSettings, type EmailAccountSummary, type AiProvider, type Subscription } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { formatBytes, usagePercent } from "@/lib/format";

type Tab = "profile" | "mail" | "ai" | "appearance" | "notifications" | "storage" | "security";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "mail", label: "Mail" },
  { id: "ai", label: "AI" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "storage", label: "Storage & plan" },
  { id: "security", label: "Security" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [me, setMe] = useState<{ email: string; username: string | null; full_name: string | null; account_type?: string; primary_address?: string } | null>(null);
  const [settings, setSettings] = useState<UserSettings>({});

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (q && TABS.some((t) => t.id === q)) setTab(q);
    api.getMe().then(({ user }) => {
      setMe({ email: user.email, username: user.username, full_name: user.full_name, account_type: user.account_type, primary_address: user.primary_address });
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

      {tab === "profile" && me && <ProfileTab me={me} address={me.primary_address ?? me.email} />}
      {tab === "mail" && <MailTab settings={settings} onSaved={setSettings} />}
      {tab === "ai" && <AiTab settings={settings} onSaved={setSettings} />}
      {tab === "appearance" && <AppearanceTab settings={settings} onSaved={setSettings} />}
      {tab === "notifications" && <NotificationsTab settings={settings} onSaved={setSettings} />}
      {tab === "storage" && <StorageTab accountType={me?.account_type} />}
      {tab === "security" && <SecurityTab />}
    </AppShell>
  );
}

function SavedNote({ show }: { show: boolean }) {
  return show ? <span className="badge badge-success ml-2">Saved</span> : null;
}

function Toggle({ on, onClick, label, desc }: { on: boolean; onClick: () => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="pr-4">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs subtle">{desc}</p>}
      </div>
      <button onClick={onClick} className="shrink-0 rounded-full transition-colors" style={{ width: 42, height: 24, background: on ? "var(--accent)" : "var(--border-strong)", position: "relative" }} aria-pressed={on}>
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: "999px", background: "#fff", transition: "left .15s" }} />
      </button>
    </div>
  );
}

function MailTab({ settings, onSaved }: { settings: UserSettings; onSaved: (s: UserSettings) => void }) {
  const [local, setLocal] = useState<UserSettings>(settings);
  const [accounts, setAccounts] = useState<EmailAccountSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);
  useEffect(() => { api.listAccounts().then(({ accounts }) => setAccounts(accounts)).catch(() => {}); }, []);

  function set<K extends keyof UserSettings>(k: K, v: UserSettings[K]) { setLocal((s) => ({ ...s, [k]: v })); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setSaved(false);
    const { settings } = await api.updateSettings(local);
    onSaved(settings); setSaved(true); setBusy(false);
  }

  return (
    <form onSubmit={save} className="card card-pad">
      <h2 className="mb-4 font-semibold">Mail <SavedNote show={saved} /></h2>
      <div className="field">
        <label className="label">Default “from” mailbox</label>
        <select value={local.defaultAccountId ?? ""} onChange={(e) => set("defaultAccountId", e.target.value)} className="select">
          <option value="">— most recent —</option>
          {accounts.map((a) => (<option key={a.id} value={a.id}>{a.email_address}</option>))}
        </select>
      </div>
      <div className="field">
        <label className="label">Signature</label>
        <textarea rows={3} value={local.signature ?? ""} onChange={(e) => set("signature", e.target.value)} className="textarea" placeholder="— Sent from nossteal.mail" />
      </div>
      <div className="border-t pt-2">
        <Toggle on={!!local.autoMarkRead} onClick={() => set("autoMarkRead", !local.autoMarkRead)} label="Auto-mark read" desc="Mark messages read as soon as you open them." />
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary mt-4">{busy ? "Saving…" : "Save mail settings"}</button>
    </form>
  );
}

function NotificationsTab({ settings, onSaved }: { settings: UserSettings; onSaved: (s: UserSettings) => void }) {
  const [local, setLocal] = useState<UserSettings>(settings);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setLocal(settings); }, [settings]);
  async function set<K extends keyof UserSettings>(k: K, v: UserSettings[K]) {
    const next = { ...local, [k]: v };
    setLocal(next);
    const { settings } = await api.updateSettings(next);
    onSaved(settings); setSaved(true); setTimeout(() => setSaved(false), 1200);
  }
  return (
    <div className="card card-pad">
      <h2 className="mb-2 font-semibold">Notifications <SavedNote show={saved} /></h2>
      <Toggle on={local.notifyNewMail !== false} onClick={() => set("notifyNewMail", !(local.notifyNewMail !== false))} label="New mail" desc="Show a notification when new mail arrives." />
      <div className="border-t" />
      <Toggle on={!!local.soundOnNewMail} onClick={() => set("soundOnNewMail", !local.soundOnNewMail)} label="Play a sound" desc="Chime on new mail." />
      <div className="border-t" />
      <Toggle on={!!local.notifyAutomation} onClick={() => set("notifyAutomation", !local.notifyAutomation)} label="Automation actions" desc="Notify when the AI acts on your behalf." />
    </div>
  );
}

function ProfileTab({ me, address }: { me: { email: string; username: string | null; full_name: string | null }; address: string }) {
  const [fullName, setFullName] = useState(me.full_name ?? "");
  const [username, setUsername] = useState(me.username ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
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

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {(me.username ?? address).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Your mail address</p>
            <p className="mono truncate text-lg font-medium">{address}</p>
          </div>
          <button onClick={copyAddress} className="btn btn-secondary btn-sm ml-auto shrink-0">{copied ? "Copied!" : "Copy"}</button>
        </div>
      </div>

    <form onSubmit={save} className="card card-pad">
      <h2 className="mb-4 font-semibold">Profile <SavedNote show={saved} /></h2>
      {error && <p className="alert alert-danger mb-4">{error}</p>}
      <div className="field">
        <label className="label">Login email</label>
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
    </div>
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
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [delPw, setDelPw] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setOk(false);
    try {
      await api.changePassword(current, next);
      setOk(true); setCurrent(""); setNext("");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm("Permanently delete your account, mailboxes, and all mail? This cannot be undone.")) return;
    setDelBusy(true); setDelError(null);
    try {
      await api.deleteMyAccount(delPw);
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
      router.replace("/");
    } catch (err) { setDelError((err as Error).message); }
    finally { setDelBusy(false); }
  }

  return (
    <div className="space-y-4">
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

      <form onSubmit={deleteAccount} className="card card-pad" style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, var(--border))" }}>
        <h2 className="mb-1 font-semibold" style={{ color: "var(--danger)" }}>Danger zone</h2>
        <p className="mb-4 text-sm muted">Delete your account, all mailboxes, and every message. This can’t be undone.</p>
        {delError && <p className="alert alert-danger mb-4">{delError}</p>}
        <div className="field">
          <label className="label">Confirm your password</label>
          <input type="password" required value={delPw} onChange={(e) => setDelPw(e.target.value)} className="input" />
        </div>
        <button type="submit" disabled={delBusy} className="btn btn-danger">{delBusy ? "Deleting…" : "Delete my account"}</button>
      </form>
    </div>
  );
}
