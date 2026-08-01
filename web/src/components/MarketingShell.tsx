"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Mail } from "./icons";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/security", label: "Security" },
  { href: "/about", label: "About" },
];

export function MarketingShell({ children, active }: { children: ReactNode; active?: string }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(!!window.localStorage.getItem("token")); }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              <Mail width={17} height={17} />
            </span>
            <span className="font-semibold tracking-tight">nossteal<span className="muted">.mail</span></span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="btn btn-ghost btn-sm" style={active === n.href ? { color: "var(--accent)" } : undefined}>{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href="https://github.com/Nos-and-Stealzers/nossteal.mail" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm hidden sm:inline-flex">GitHub</a>
            <ThemeToggle />
            {signedIn ? (
              <Link href="/inbox" className="btn btn-primary btn-sm">Open app</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="fadeup">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm sm:flex-row">
          <div className="flex items-center gap-2 muted"><Mail width={15} height={15} /> nossteal.mail — self-hosted mail + AI</div>
          <div className="flex items-center gap-4 subtle">
            {NAV.map((n) => (<Link key={n.href} href={n.href} className="link">{n.label}</Link>))}
            <a href="https://github.com/Nos-and-Stealzers/nossteal.mail" target="_blank" rel="noreferrer" className="link">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PageHero({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <section className="relative overflow-hidden border-b">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(55% 60% at 50% 0%, var(--accent-soft), transparent 70%)" }} />
      <div className="relative mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
        <div className="eyebrow mb-3">{eyebrow}</div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg muted">{subtitle}</p>
      </div>
    </section>
  );
}
