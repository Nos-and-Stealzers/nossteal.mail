"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { persistSession } from "@/lib/useAuth";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mailDomain, setMailDomain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getSignupInfo().then(({ mailDomain }) => setMailDomain(mailDomain)).catch(() => setMailDomain(null));
  }, []);

  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const previewAddress = mailDomain && cleanUser ? `${cleanUser}@${mailDomain}` : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, token } = await api.register({
        username: cleanUser,
        password,
        fullName: fullName || undefined,
        email: mailDomain ? undefined : email,
      });
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
      title="Create your account"
      subtitle="Pick a username — that becomes your email address."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="link">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && <p className="alert alert-danger mb-4">{error}</p>}

        <div className="field">
          <label className="label">Username</label>
          {mailDomain ? (
            <div className="flex items-center gap-2">
              <input
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="you"
              />
              <span className="whitespace-nowrap text-sm subtle">@{mailDomain}</span>
            </div>
          ) : (
            <input required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="username" />
          )}
        </div>

        {previewAddress && (
          <div className="alert alert-info mb-4">
            Your email address will be <strong className="mono">{previewAddress}</strong>
          </div>
        )}

        {!mailDomain && (
          <div className="field">
            <label className="label">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
          </div>
        )}

        <div className="field">
          <label className="label">Full name <span className="subtle">(optional)</span></label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder="Ada Lovelace" />
        </div>

        <div className="field">
          <label className="label">Password <span className="subtle">(min 8 characters)</span></label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" />
        </div>

        <button type="submit" disabled={loading || !cleanUser} className="btn btn-primary btn-lg mt-1 w-full">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
