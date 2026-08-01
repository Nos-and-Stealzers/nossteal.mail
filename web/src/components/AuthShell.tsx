import type { ReactNode } from "react";
import Link from "next/link";
import { Mail } from "./icons";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(55% 45% at 50% 0%, var(--accent-soft), transparent 70%)" }}
      />
      <div className="relative w-full max-w-sm fadeup">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            <Mail width={18} height={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight">nossteal<span className="muted">.mail</span></span>
        </Link>

        <div className="card card-pad" style={{ boxShadow: "var(--shadow)" }}>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 mb-5 text-sm muted">{subtitle}</p>
          {children}
        </div>

        <p className="mt-5 text-center text-sm muted">{footer}</p>
      </div>
    </main>
  );
}
