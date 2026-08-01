"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Conversation } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Back } from "@/components/icons";

export default function WorkspaceConversationsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .listConversations(params.id)
      .then((res) => setConversations(res.conversations))
      .catch((err) => setError((err as Error).message));
  }, [params.id]);

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

  return (
    <AppShell
      title="Conversations"
      maxWidth="44rem"
      actions={
        <>
          <Link href="/workspaces" className="btn btn-ghost btn-sm"><Back width={15} height={15} /> Workspaces</Link>
          <button onClick={newConversation} disabled={creating} className="btn btn-primary btn-sm">
            {creating ? "Creating…" : "New chat"}
          </button>
        </>
      }
    >
      {error && <p className="alert alert-danger mb-4">{error}</p>}
      {!conversations.length ? (
        <div className="empty">No conversations yet. Start one with “New chat”.</div>
      ) : (
        <div className="list">
          {conversations.map((c) => (
            <Link key={c.id} href={`/workspaces/${params.id}/${c.id}`} className="list-row">
              <span className="flex-1 truncate text-sm font-medium">{c.title || "Untitled"}</span>
              <span className="badge">{c.message_count} msgs</span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
