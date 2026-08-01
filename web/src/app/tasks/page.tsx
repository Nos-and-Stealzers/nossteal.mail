"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type Task } from "@/lib/api";

export default function TasksPage() {
  const { loading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

  async function refresh() {
    const { tasks } = await api.listTasks();
    setTasks(tasks);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createTask({ title });
      setTitle("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: Task) {
    await api.updateTask(task.id, { isDone: !task.is_done });
    await refresh();
  }

  async function handleDelete(id: string) {
    await api.deleteTask(id);
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
          <h1 className="mb-3 text-xl font-semibold">Tasks</h1>
          {!tasks.length ? (
            <p className="text-neutral-500">No tasks yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={t.is_done} onChange={() => toggleDone(t)} />
                    <span className={t.is_done ? "text-neutral-500 line-through" : ""}>{t.title}</span>
                  </label>
                  <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:underline">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">New task</h2>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
