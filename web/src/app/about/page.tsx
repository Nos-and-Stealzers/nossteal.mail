"use client";

import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/MarketingShell";

const stack = [
  { t: "API", d: "Express + TypeScript, PostgreSQL" },
  { t: "Web", d: "Next.js 16, React 19, Tailwind" },
  { t: "Mail", d: "IMAP/SMTP, native SMTP receiver, DKIM" },
  { t: "AI", d: "Anthropic / OpenAI-compatible / Ollama" },
];

export default function AboutPage() {
  return (
    <MarketingShell active="/about">
      <PageHero eyebrow="About" title="Mail you actually own" subtitle="A from-scratch, self-hostable email platform with an AI assistant — built to be understood, not just used." />
      <div className="mx-auto max-w-3xl px-5 py-14">
        <div className="space-y-5 text-[15px] leading-relaxed muted">
          <p>
            nossteal.mail started as a simple idea: your inbox and your AI assistant should run on
            infrastructure <strong style={{ color: "var(--text)" }}>you</strong> control. No lock-in, no
            mining your mail, no mystery about where your data lives.
          </p>
          <p>
            It unifies the mailboxes you already have with addresses on your own domain, and lets you point
            the assistant at whatever model you trust — including one running entirely on your own machine.
            The whole stack is open source and readable, so you can see exactly how it works.
          </p>
          <p>
            It's built for people who want to tinker, self-host, and keep ownership of their communication —
            two friends on a home PC or a small team on a server, all the same.
          </p>
        </div>

        <h2 className="mb-4 mt-10 text-lg font-semibold" style={{ color: "var(--text)" }}>Under the hood</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {stack.map((s) => (
            <div key={s.t} className="card card-pad">
              <p className="font-semibold">{s.t}</p>
              <p className="text-sm muted">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="btn btn-primary btn-lg">Create your account</Link>
          <a href="https://github.com/Nos-and-Stealzers/nossteal.mail" target="_blank" rel="noreferrer" className="btn btn-secondary btn-lg">View on GitHub</a>
        </div>
      </div>
    </MarketingShell>
  );
}
