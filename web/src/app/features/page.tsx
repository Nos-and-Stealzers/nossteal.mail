"use client";

import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/MarketingShell";
import { Inbox, Globe, Sparkles, Server, Flow, Shield, Plug, Note, Check, Users, Card } from "@/components/icons";

const groups = [
  {
    title: "Mail",
    items: [
      { icon: Inbox, t: "Unified inbox", d: "Read every connected account and native mailbox in one place, with folders, search, star, and one-click delete." },
      { icon: Users, t: "Bring your accounts", d: "Connect any IMAP/SMTP mailbox — Gmail, Fastmail, your own server — alongside addresses on your own domain." },
      { icon: Globe, t: "Your own domain", d: "Host mailboxes on a domain you own, with DKIM/SPF/DMARC generated for you and copy-paste DNS records." },
    ],
  },
  {
    title: "AI",
    items: [
      { icon: Sparkles, t: "Bring your own AI", d: "Anthropic, any OpenAI-compatible API, or a fully local model via Ollama. Your keys, encrypted at rest." },
      { icon: Shield, t: "Automation with guardrails", d: "Manual, assisted, or full automation — with explicit consent, an audit log, and an instant emergency pause." },
      { icon: Server, t: "MCP + plugins", d: "Connect Model Context Protocol servers and install permission-gated plugins to extend the assistant." },
    ],
  },
  {
    title: "Productivity & accounts",
    items: [
      { icon: Note, t: "Notes & tasks", d: "Lightweight notes and a to-do list built right into your mail workspace." },
      { icon: Flow, t: "Workflows", d: "Chain steps — create tasks, notes, or send an AI message — into repeatable automations." },
      { icon: Card, t: "Storage & plans", d: "Per-mailbox storage quotas with live usage. AI sub-mailboxes stay lightweight by design." },
      { icon: Plug, t: "Invite-only option", d: "Run it open to the world or lock signups behind single-use invite codes you generate." },
      { icon: Check, t: "Full settings", d: "Profile, mail, AI defaults, appearance, notifications, storage, and security — all in one hub." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell active="/features">
      <PageHero eyebrow="Features" title="Everything an inbox should be" subtitle="A complete, self-hosted mail workspace with an AI assistant wired through all of it." />
      <div className="mx-auto max-w-6xl px-5 py-14">
        {groups.map((g) => (
          <section key={g.title} className="mb-12">
            <h2 className="mb-5 text-xl font-semibold tracking-tight">{g.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.t} className="card card-pad">
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      <Icon width={20} height={20} />
                    </span>
                    <h3 className="mb-1 font-semibold">{f.t}</h3>
                    <p className="text-sm muted">{f.d}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <div className="card card-pad flex flex-col items-center gap-4 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Ready to try it?</h2>
          <Link href="/register" className="btn btn-primary btn-lg">Create your account</Link>
        </div>
      </div>
    </MarketingShell>
  );
}
