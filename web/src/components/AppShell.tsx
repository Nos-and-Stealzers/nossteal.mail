"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import {
  Inbox, Pen, Users, Globe, Sparkles, Server, Plug, Note, Check, Flow,
  Card, Shield, Logout, Menu, Close, Mail,
} from "./icons";

type NavItem = { href: string; label: string; icon: (p: { width?: number; height?: number }) => ReactNode };

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Mail",
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/compose", label: "Compose", icon: Pen },
    ],
  },
  {
    title: "Accounts",
    items: [
      { href: "/accounts", label: "Email accounts", icon: Users },
      { href: "/domains", label: "Domains", icon: Globe },
    ],
  },
  {
    title: "AI",
    items: [
      { href: "/workspaces", label: "Workspaces", icon: Sparkles },
      { href: "/ai-providers", label: "Providers", icon: Server },
      { href: "/mcp-servers", label: "MCP servers", icon: Server },
      { href: "/plugins", label: "Plugins", icon: Plug },
    ],
  },
  {
    title: "Productivity",
    items: [
      { href: "/notes", label: "Notes", icon: Note },
      { href: "/tasks", label: "Tasks", icon: Check },
      { href: "/workflows", label: "Workflows", icon: Flow },
    ],
  },
];

export function AppShell({
  title,
  actions,
  children,
  maxWidth = "48rem",
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (loading || !user) return null;

  const accountItems: NavItem[] = [{ href: "/billing", label: "Billing", icon: Card }];
  if (user.is_admin) accountItems.push({ href: "/admin", label: "Admin", icon: Shield });

  const isActive = (href: string) =>
    pathname === href || (href !== "/inbox" && pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
          <Mail width={17} height={17} />
        </span>
        <span className="font-semibold tracking-tight">nossteal<span className="muted">.mail</span></span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {[...groups, { title: "Account", items: accountItems }].map((g) => (
          <div key={g.title}>
            <div className="section-label">{g.title}</div>
            {g.items.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  data-active={isActive(it.href)}
                  className="sidebar-link"
                  onClick={() => setOpen(false)}
                >
                  <Icon width={17} height={17} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            {(user.username ?? user.email ?? "?").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.username ?? "Account"}</div>
            <div className="truncate text-xs subtle">{user.email}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex sticky top-0 h-screen shrink-0 flex-col border-r"
        style={{ width: "var(--sidebar-w)", background: "var(--surface)" }}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r" style={{ background: "var(--surface)" }}>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur"
          style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)" }}
        >
          <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu width={18} height={18} />
          </button>
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <ThemeToggle />
            <button onClick={logout} className="btn btn-ghost btn-sm" title="Log out">
              <Logout width={16} height={16} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full fadeup" style={{ maxWidth }}>{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Small helper for mobile drawer close icon reuse elsewhere if needed. */
export { Close };
