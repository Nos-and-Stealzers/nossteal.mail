"use client";

import { useEffect, useState } from "react";
import { api, type Note } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

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

  return (
    <AppShell title="Notes" maxWidth="44rem">
      <form onSubmit={handleSubmit} className="card card-pad mb-6">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="input mb-3" />
        <textarea rows={4} placeholder="Write a note…" value={content} onChange={(e) => setContent(e.target.value)} className="textarea mb-3" />
        <button type="submit" disabled={saving || (!title && !content)} className="btn btn-primary">
          {saving ? "Saving…" : "Add note"}
        </button>
      </form>

      {!notes.length ? (
        <div className="empty">No notes yet. Jot something down above.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <div key={n.id} className="card card-pad">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{n.title || "Untitled"}</p>
                <button onClick={() => handleDelete(n.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>Delete</button>
              </div>
              {n.content && <p className="mt-2 whitespace-pre-wrap text-sm muted">{n.content}</p>}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
