"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DOMPurify from "dompurify";
import { useAuth } from "@/lib/useAuth";
import { api, type MessageDetail } from "@/lib/api";

export default function MessageDetailPage() {
  const { loading } = useAuth();
  const params = useParams<{ id: string }>();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    api
      .getMessage(params.id)
      .then((res) => setMessage(res.message))
      .catch((err) => setError((err as Error).message));
  }, [loading, params.id]);

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <Link href="/inbox" className="text-sm text-indigo-400 hover:underline">
          ← Back to inbox
        </Link>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-6">
        {error && <p className="rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
        {message && (
          <article className="space-y-4">
            <h1 className="text-xl font-semibold">{message.subject ?? "(no subject)"}</h1>
            <div className="text-sm text-neutral-400">
              <p>From: {message.from_address}</p>
              <p>To: {message.to_addresses?.join(", ")}</p>
              {message.date_received && <p>{new Date(message.date_received).toLocaleString()}</p>}
            </div>
            <div className="rounded border border-neutral-800 p-4">
              {message.body_html ? (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.body_html) }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans">{message.body_plaintext}</pre>
              )}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
