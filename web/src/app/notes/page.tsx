"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type Note } from "@/lib/api";

export default function NotesPage() {
  const { loading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

  async function refresh() {
    const { notes } = await api.listNotes();
    setNotes(notes);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createNote({ title: title || undefined, content: content || undefined });
      setTitle("");
      setContent("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteNote(id);
    await refresh();
  }

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <Link href="/inbox" className="text-sm text-indigo-400 hover:underline">
          ← Back to inbox
        </Link>
      </header>
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
        <section>
          <h1 className="mb-3 text-xl font-semibold">Notes</h1>
          {!notes.length ? (
            <p className="text-neutral-500">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded border border-neutral-800 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{n.title || "Untitled"}</p>
                      <p className="mt-1 whitespace-pre-wrap text-neutral-400">{n.content}</p>
                    </div>
                    <button onClick={() => handleDelete(n.id)} className="text-red-400 hover:underline">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">New note</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <textarea
              rows={5}
              placeholder="Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add note"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
