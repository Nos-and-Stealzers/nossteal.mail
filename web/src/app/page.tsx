"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Globe, Sparkles, Server, Flow, Shield, Mail } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  { icon: Inbox, title: "Unified inbox", body: "Read every connected account and every native mailbox in one clean, fast inbox." },
  { icon: Globe, title: "Your own domain", body: "Host mailboxes on a domain you own, with DKIM, SPF and DMARC generated for you." },
  { icon: Sparkles, title: "Bring your own AI", body: "Anthropic, any OpenAI-compatible API, or a fully local model via Ollama. Your keys, your data." },
  { icon: Shield, title: "Automation with guardrails", body: "Let the assistant triage and act — with consent gates, an audit log, and an instant pause." },
  { icon: Server, title: "Extensible", body: "Connect MCP servers and install plugins to give the assistant new tools." },
  { icon: Flow, title: "Notes, tasks & workflows", body: "Turn email into action with built-in notes, tasks, and multi-step automations." },
];

export default function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(!!window.localStorage.getItem("token"));
  }, []);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            <Mail width={17} height={17} />
          </span>
          <span className="font-semibold tracking-tight">nossteal<span className="muted">.mail</span></span>
          <nav className="ml-auto flex items-center gap-2">
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
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 55% at 50% 0%, var(--accent-soft), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-20 text-center sm:pt-28">
          <div className="badge badge-accent mx-auto mb-6 fadeup">Self-hosted · Bring your own AI</div>
          <h1 className="fadeup text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Your mail. Your AI.<br />On your terms.
          </h1>
          <p className="fadeup mx-auto mt-5 max-w-xl text-lg muted">
            nossteal.mail is a self-hosted email platform with a built-in AI assistant. Connect your
            mailboxes, host your own domain, and run the model in the cloud — or entirely on your
            machine.
          </p>
          <div className="fadeup mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={signedIn ? "/inbox" : "/register"} className="btn btn-primary btn-lg">
              {signedIn ? "Open your inbox" : "Get started — it's yours"}
            </Link>
            <a href="https://github.com/Nos-and-Stealzers/nossteal.mail" target="_blank" rel="noreferrer" className="btn btn-secondary btn-lg">
              View on GitHub
            </a>
          </div>
          <p className="mt-4 text-sm subtle">Open source · MIT licensed · No vendor lock-in</p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="eyebrow mb-2">What you get</div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything an inbox should be — and more</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card card-pad">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Icon width={20} height={20} />
                </span>
                <h3 className="mb-1 font-semibold">{f.title}</h3>
                <p className="text-sm muted">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="card card-pad flex flex-col items-center gap-4 py-10 text-center sm:py-14">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready in minutes, yours forever</h2>
          <p className="max-w-lg muted">
            Create an account, connect a mailbox or spin up your own domain, and point the assistant
            at the model of your choice.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href={signedIn ? "/inbox" : "/register"} className="btn btn-primary btn-lg">
              {signedIn ? "Go to inbox" : "Create your account"}
            </Link>
            {!signedIn && <Link href="/login" className="btn btn-secondary btn-lg">Sign in</Link>}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm sm:flex-row">
          <div className="flex items-center gap-2 muted">
            <Mail width={15} height={15} /> nossteal.mail — self-hosted mail + AI
          </div>
          <div className="flex items-center gap-4 subtle">
            <a href="https://github.com/Nos-and-Stealzers/nossteal.mail" target="_blank" rel="noreferrer" className="link">GitHub</a>
            <Link href="/login" className="link">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
