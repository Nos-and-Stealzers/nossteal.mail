"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type Conversation } from "@/lib/api";

export default function WorkspaceConversationsPage() {
  const { loading } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (loading) return;
    api
      .listConversations(params.id)
      .then((res) => setConversations(res.conversations))
      .catch((err) => setError((err as Error).message));
  }, [loading, params.id]);

  async function newConversation() {
    setCreating(true);
    try {
      const { conversation } = await api.createConversation(params.id, "New conversation");
      router.push(`/workspaces/${params.id}/${conversation.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <Link href="/workspaces" className="text-sm text-indigo-400 hover:underline">
          ← Back to workspaces
        </Link>
        <button
          onClick={newConversation}
          disabled={creating}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {creating ? "Creating..." : "New conversation"}
        </button>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-6">
        {error && <p className="mb-4 rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
        {!conversations.length ? (
          <p className="text-neutral-500">No conversations yet. Start one above.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/workspaces/${params.id}/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-900"
                >
                  <span>{c.title || "Untitled"}</span>
                  <span className="text-xs text-neutral-500">{c.message_count} messages</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
