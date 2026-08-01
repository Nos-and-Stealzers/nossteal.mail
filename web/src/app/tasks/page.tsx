"use client";

import { useEffect, useState } from "react";
import { api, type Task } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

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

  const done = tasks.filter((t) => t.is_done).length;

  return (
    <AppShell title="Tasks" maxWidth="42rem">
      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <input placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Adding…" : "Add"}</button>
      </form>

      {!tasks.length ? (
        <div className="empty">No tasks yet. Add your first one above.</div>
      ) : (
        <>
          <p className="mb-2 text-sm subtle">{done} of {tasks.length} done</p>
          <div className="list">
            {tasks.map((t) => (
              <div key={t.id} className="list-row">
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={t.is_done} onChange={() => toggleDone(t)} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className={`text-sm ${t.is_done ? "subtle line-through" : ""}`}>{t.title}</span>
                </label>
                <button onClick={() => handleDelete(t.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
