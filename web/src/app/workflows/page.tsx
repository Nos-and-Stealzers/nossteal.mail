"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type Workflow, type WorkflowStep, type WorkflowExecution, type Workspace } from "@/lib/api";

type StepType = WorkflowStep["type"];

export default function WorkflowsPage() {
  const { loading } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

  async function refresh() {
    const [{ workflows }, { workspaces }] = await Promise.all([api.listWorkflows(), api.listWorkspaces()]);
    setWorkflows(workflows);
    setWorkspaces(workspaces);
  }

  function addStep(type: StepType) {
    if (type === "create_task") setSteps((s) => [...s, { type, params: { title: "" } }]);
    else if (type === "create_note") setSteps((s) => [...s, { type, params: { title: "", content: "" } }]);
    else setSteps((s) => [...s, { type, params: { workspaceId: workspaces[0]?.id ?? "", content: "" } }]);
  }

  function updateStep(index: number, params: Record<string, string>) {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, params: { ...step.params, ...params } } as WorkflowStep : step)));
  }

  function removeStep(index: number) {
    setSteps((s) => s.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createWorkflow({ name, steps });
      setName("");
      setSteps([]);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteWorkflow(id);
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
          <h1 className="mb-3 text-xl font-semibold">Workflows</h1>
          <p className="mb-4 text-sm text-neutral-500">
            Workflows here only run when you click Run — scheduled and email-triggered runs need a background
            job runner that isn&apos;t built yet.
          </p>
          {!workflows.length ? (
            <p className="text-neutral-500">No workflows yet.</p>
          ) : (
            <ul className="space-y-3">
              {workflows.map((w) => (
                <WorkflowCard key={w.id} workflow={w} onChange={refresh} onDelete={handleDelete} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Create workflow</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
            <input
              required
              placeholder="Workflow name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
            />

            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="rounded border border-neutral-800 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{i + 1}. {step.type}</span>
                    <button type="button" onClick={() => removeStep(i)} className="text-red-400 hover:underline">
                      Remove
                    </button>
                  </div>
                  {step.type === "create_task" && (
                    <input
                      placeholder="Task title"
                      value={step.params.title}
                      onChange={(e) => updateStep(i, { title: e.target.value })}
                      className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
                    />
                  )}
                  {step.type === "create_note" && (
                    <div className="space-y-2">
                      <input
                        placeholder="Note title"
                        value={step.params.title}
                        onChange={(e) => updateStep(i, { title: e.target.value })}
                        className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
                      />
                      <textarea
                        placeholder="Note content"
                        value={step.params.content}
                        onChange={(e) => updateStep(i, { content: e.target.value })}
                        className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
                      />
                    </div>
                  )}
                  {step.type === "send_ai_message" && (
                    <div className="space-y-2">
                      <select
                        value={step.params.workspaceId}
                        onChange={(e) => updateStep(i, { workspaceId: e.target.value })}
                        className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
                      >
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                      <textarea
                        placeholder="Message to send"
                        value={step.params.content}
                        onChange={(e) => updateStep(i, { content: e.target.value })}
                        className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => addStep("create_task")} className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-900">
                + Create task
              </button>
              <button type="button" onClick={() => addStep("create_note")} className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-900">
                + Create note
              </button>
              <button
                type="button"
                onClick={() => addStep("send_ai_message")}
                disabled={!workspaces.length}
                className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-900 disabled:opacity-50"
              >
                + Send AI message
              </button>
            </div>

            <button
              type="submit"
              disabled={saving || !steps.length}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create workflow"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function WorkflowCard({
  workflow,
  onChange,
  onDelete,
}: {
  workflow: Workflow;
  onChange: () => void;
  onDelete: (id: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [lastExecution, setLastExecution] = useState<WorkflowExecution | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const { execution } = await api.runWorkflow(workflow.id);
      setLastExecution(execution);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <li className="rounded border border-neutral-800 px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{workflow.name}</p>
          <p className="text-neutral-500">
            {workflow.workflow_definition.length} steps · ran {workflow.execution_count}x
            {workflow.last_execution_at ? ` · last: ${new Date(workflow.last_execution_at).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={running}
            className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {running ? "Running..." : "Run"}
          </button>
          <button onClick={() => onDelete(workflow.id)} className="text-red-400 hover:underline">
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mt-2 rounded bg-red-950 p-2 text-xs text-red-300">{error}</p>}
      {lastExecution && (
        <div className="mt-2 space-y-1 rounded border border-neutral-800 p-2 text-xs">
          <p className={lastExecution.status === "success" ? "text-emerald-400" : "text-amber-400"}>
            {lastExecution.status} · {new Date(lastExecution.started_at).toLocaleTimeString()}
          </p>
          {lastExecution.step_results.map((r, i) => (
            <p key={i} className={r.status === "success" ? "text-neutral-400" : "text-red-400"}>
              {r.type}: {r.status === "success" ? "ok" : r.error}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}
