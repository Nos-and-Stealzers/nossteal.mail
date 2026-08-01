"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { api, type AdminStats, type AdminUser, type Invite } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!user.is_admin) {
      setError("Admin access required.");
      return;
    }
    Promise.all([api.getAdminStats(), api.listAdminUsers(), api.listInvites()])
      .then(([s, u, i]) => {
        setStats(s.stats);
        setUsers(u.users);
        setInvites(i.invites);
      })
      .catch((err) => setError((err as Error).message));
  }, [user]);

  async function generateInvite() {
    try {
      await api.createInvite();
      const { invites } = await api.listInvites();
      setInvites(invites);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
  }

  async function toggleAdmin(target: AdminUser) {
    try {
      await api.setUserAdmin(target.id, !target.is_admin);
      const { users } = await api.listAdminUsers();
      setUsers(users);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AppShell title="Admin" maxWidth="48rem">
      {error && <p className="alert alert-danger mb-6">{error}</p>}

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Users" value={stats.users} />
          <Stat label="Messages" value={stats.messages} />
          <Stat label="AI providers" value={stats.aiProviders} />
          <Stat label="Workflows" value={stats.workflows} />
          <Stat label="Domains" value={stats.domains} />
        </div>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide subtle">Invite codes</h2>
          <button onClick={generateInvite} className="btn btn-primary btn-sm">Generate invite</button>
        </div>
        {!invites.length ? (
          <div className="empty">No invites yet. Generate one to let someone sign up.</div>
        ) : (
          <div className="list">
            {invites.map((inv) => (
              <div key={inv.code} className="list-row">
                <span className="mono flex-1 truncate">{inv.code}</span>
                {inv.used_at ? (
                  <span className="badge">used{inv.used_by ? ` · ${inv.used_by}` : ""}</span>
                ) : (
                  <span className="badge badge-success">available</span>
                )}
                {!inv.used_at && (
                  <button onClick={() => copyCode(inv.code)} className="btn btn-ghost btn-sm">{copied === inv.code ? "Copied!" : "Copy"}</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {!!users.length && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Users</h2>
          <div className="list">
            {users.map((u) => (
              <div key={u.id} className="list-row">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {(u.username ?? u.email).slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{u.username ?? u.email}</span>
                    {u.is_admin && <span className="badge badge-accent">admin</span>}
                  </div>
                  <p className="truncate text-xs subtle">{u.email} · {u.account_type} · {u.subscription_status}</p>
                </div>
                <button onClick={() => toggleAdmin(u)} disabled={u.id === user?.id && u.is_admin} className="btn btn-ghost btn-sm">
                  {u.is_admin ? "Revoke admin" : "Make admin"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card card-pad text-center">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs subtle">{label}</p>
    </div>
  );
}
