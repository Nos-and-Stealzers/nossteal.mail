"use client";

import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/MarketingShell";
import { Shield, Server, Sparkles, Globe } from "@/components/icons";

const points = [
  { icon: Shield, t: "Encrypted at rest", d: "Mailbox passwords, AI provider keys, and DKIM private keys are encrypted with AES-256-GCM. The database never holds them in the clear." },
  { icon: Server, t: "Self-hosted", d: "Everything runs on infrastructure you control — your machine or your server. No third party sits between you and your mail." },
  { icon: Sparkles, t: "You own the AI", d: "Point the assistant at a cloud model or run it entirely locally with Ollama. With a local model, nothing leaves your hardware." },
  { icon: Globe, t: "Consent-gated automation", d: "The assistant only acts within the mode you choose. Full automation needs an explicit confirmation, everything is logged, and one click pauses it." },
];

export default function SecurityPage() {
  return (
    <MarketingShell active="/security">
      <PageHero eyebrow="Security & privacy" title="You hold the keys" subtitle="Self-hosted by design, encrypted where it counts, and honest about what runs where." />
      <div className="mx-auto max-w-4xl px-5 py-14">
        <div className="grid gap-4 sm:grid-cols-2">
          {points.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.t} className="card card-pad">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Icon width={20} height={20} />
                </span>
                <h3 className="mb-1 font-semibold">{p.t}</h3>
                <p className="text-sm muted">{p.d}</p>
              </div>
            );
          })}
        </div>

        <div className="card card-pad mt-8">
          <h2 className="mb-3 text-lg font-semibold">The basics, done right</h2>
          <ul className="space-y-2 text-sm muted">
            <li className="flex gap-2"><span style={{ color: "var(--accent)" }}>✓</span> Passwords hashed with bcrypt — never stored in plaintext.</li>
            <li className="flex gap-2"><span style={{ color: "var(--accent)" }}>✓</span> Sessions via signed JWTs.</li>
            <li className="flex gap-2"><span style={{ color: "var(--accent)" }}>✓</span> HTML mail sanitized before it's ever rendered.</li>
            <li className="flex gap-2"><span style={{ color: "var(--accent)" }}>✓</span> Optional invite-only signups so only people you choose can join.</li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <Link href="/register" className="btn btn-primary btn-lg">Get started</Link>
        </div>
      </div>
    </MarketingShell>
  );
}
