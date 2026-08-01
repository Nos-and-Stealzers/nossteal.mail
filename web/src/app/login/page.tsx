"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { persistSession } from "@/lib/useAuth";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, token } = await api.login(identifier, password);
      persistSession(user, token);
      router.push("/inbox");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your nossteal.mail account."
      footer={
        <>
          No account?{" "}
          <Link href="/register" className="link">Create one</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && <p className="alert alert-danger mb-4">{error}</p>}
        <div className="field">
          <label className="label">Email or username</label>
          <input
            required
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="input"
            placeholder="you@example.com"
          />
        </div>
        <div className="field">
          <label className="label">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary btn-lg mt-1 w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
