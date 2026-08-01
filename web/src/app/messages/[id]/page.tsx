"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DOMPurify from "dompurify";
import { api, type MessageDetail } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Back } from "@/components/icons";

export default function MessageDetailPage() {
  const params = useParams<{ id: string }>();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMessage(params.id)
      .then((res) => setMessage(res.message))
      .catch((err) => setError((err as Error).message));
  }, [params.id]);

  const initials = (addr: string | null) => (addr ?? "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

  return (
    <AppShell
      title="Message"
      maxWidth="46rem"
      actions={<Link href="/inbox" className="btn btn-ghost btn-sm"><Back width={15} height={15} /> Inbox</Link>}
    >
      {error && <p className="alert alert-danger mb-4">{error}</p>}
      {message && (
        <article>
          <h1 className="text-2xl font-semibold tracking-tight">{message.subject ?? "(no subject)"}</h1>

          <div className="mt-4 flex items-center gap-3 border-b pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {initials(message.from_address)}
            </span>
            <div className="min-w-0 text-sm">
              <div className="font-medium">{message.from_address}</div>
              <div className="subtle">to {message.to_addresses?.join(", ")}</div>
            </div>
            {message.date_received && (
              <div className="ml-auto text-xs subtle">{new Date(message.date_received).toLocaleString()}</div>
            )}
          </div>

          <div className="mt-5 leading-relaxed" style={{ color: "var(--text)" }}>
            {message.body_html ? (
              <div className="prose-mail" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.body_html) }} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm" style={{ color: "var(--text)" }}>{message.body_plaintext}</pre>
            )}
          </div>

          <div className="mt-8">
            <Link href="/compose" className="btn btn-primary btn-sm">Reply</Link>
          </div>
        </article>
      )}
    </AppShell>
  );
}
