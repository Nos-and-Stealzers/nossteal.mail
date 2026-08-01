"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type ConversationMessage } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Back } from "@/components/icons";

export default function ChatPage() {
  const params = useParams<{ id: string; conversationId: string }>();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function refresh() {
    const { messages } = await api.listConversationMessages(params.conversationId);
    setMessages(messages);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);
    setSending(true);
    const optimisticUser: ConversationMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: input,
      tokens_used: 0,
      model_name: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimisticUser]);
    setInput("");
    try {
      await api.sendConversationMessage(params.conversationId, optimisticUser.content);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      await refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell
      title="Chat"
      maxWidth="46rem"
      actions={<Link href={`/workspaces/${params.id}`} className="btn btn-ghost btn-sm"><Back width={15} height={15} /> Conversations</Link>}
    >
      <div className="flex flex-col" style={{ height: "calc(100vh - 9rem)" }}>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {!messages.length && (
            <div className="empty">Say hello to start the conversation.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={
                  m.role === "user"
                    ? { background: "var(--accent)", color: "var(--accent-fg)", borderBottomRightRadius: 6 }
                    : { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: 6 }
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <p className="alert alert-danger mt-3">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the AI…"
            className="input"
            autoFocus
          />
          <button type="submit" disabled={sending} className="btn btn-primary">{sending ? "…" : "Send"}</button>
        </form>
      </div>
    </AppShell>
  );
}
