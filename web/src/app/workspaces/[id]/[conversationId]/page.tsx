"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type ConversationMessage } from "@/lib/api";

export default function ChatPage() {
  const { loading } = useAuth();
  const params = useParams<{ id: string; conversationId: string }>();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading, params.conversationId]);

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

  if (loading) return null;

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <Link href={`/workspaces/${params.id}`} className="text-sm text-indigo-400 hover:underline">
          ← Back to conversations
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-6">
        <div className="flex-1 space-y-4 overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                  m.role === "user" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mt-4 rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the AI..."
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}
