"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type AdminStats, type AdminUser } from "@/lib/api";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
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
  }, [loading, user]);

  async function toggleAdmin(target: AdminUser) {
    try {
      await api.setUserAdmin(target.id, !target.is_admin);
      const { users } = await api.listAdminUsers();
      setUsers(users);
    } catch (err) {
      setError((err as Error).message);
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
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        {error && <p className="rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}

        {stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Users" value={stats.users} />
            <Stat label="Messages" value={stats.messages} />
            <Stat label="AI providers" value={stats.aiProviders} />
            <Stat label="Workflows" value={stats.workflows} />
            <Stat label="Domains" value={stats.domains} />
          </div>
        )}

        {!!users.length && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Users</h2>
            <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {u.username ?? u.email} {u.is_admin && <span className="text-xs text-emerald-400">admin</span>}
                    </p>
                    <p className="text-neutral-500">
                      {u.email} · {u.account_type} · {u.subscription_status}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleAdmin(u)}
                    disabled={u.id === user?.id && u.is_admin}
                    className="text-indigo-400 hover:underline disabled:opacity-50"
                  >
                    {u.is_admin ? "Revoke admin" : "Make admin"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-neutral-800 p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
