"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { api, type AdminStats, type AdminUser } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!user.is_admin) {
      setError("Admin access required.");
      return;
    }
    Promise.all([api.getAdminStats(), api.listAdminUsers()])
      .then(([s, u]) => {
        setStats(s.stats);
        setUsers(u.users);
      })
      .catch((err) => setError((err as Error).message));
  }, [user]);

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
