"use client";

import { useEffect, useState } from "react";
import { api, type Workflow, type WorkflowStep, type WorkflowExecution, type Workspace } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

type StepType = WorkflowStep["type"];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

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

  return (
    <AppShell title="Workflows" maxWidth="44rem">
      <p className="mb-5 text-sm muted">
        Workflows run when you click Run — scheduled and email-triggered runs need a background job
        runner that isn&apos;t built yet.
      </p>

      {!workflows.length ? (
        <div className="empty mb-8">No workflows yet. Build one below.</div>
      ) : (
        <div className="mb-8 space-y-3">
          {workflows.map((w) => (
            <WorkflowCard key={w.id} workflow={w} onChange={refresh} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Create workflow</h2>
      <form onSubmit={handleSubmit} className="card card-pad">
        {error && <p className="alert alert-danger mb-4">{error}</p>}
        <input required placeholder="Workflow name" value={name} onChange={(e) => setName(e.target.value)} className="input mb-3" />

        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="rounded-lg border p-3" style={{ background: "var(--surface-2)" }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{i + 1}. {step.type.replace(/_/g, " ")}</span>
                <button type="button" onClick={() => removeStep(i)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>Remove</button>
              </div>
              {step.type === "create_task" && (
                <input placeholder="Task title" value={step.params.title} onChange={(e) => updateStep(i, { title: e.target.value })} className="input" />
              )}
              {step.type === "create_note" && (
                <div className="space-y-2">
                  <input placeholder="Note title" value={step.params.title} onChange={(e) => updateStep(i, { title: e.target.value })} className="input" />
                  <textarea placeholder="Note content" value={step.params.content} onChange={(e) => updateStep(i, { content: e.target.value })} className="textarea" />
                </div>
              )}
              {step.type === "send_ai_message" && (
                <div className="space-y-2">
                  <select value={step.params.workspaceId} onChange={(e) => updateStep(i, { workspaceId: e.target.value })} className="select">
                    {workspaces.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                  </select>
                  <textarea placeholder="Message to send" value={step.params.content} onChange={(e) => updateStep(i, { content: e.target.value })} className="textarea" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="my-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => addStep("create_task")} className="btn btn-secondary btn-sm">+ Task</button>
          <button type="button" onClick={() => addStep("create_note")} className="btn btn-secondary btn-sm">+ Note</button>
          <button type="button" onClick={() => addStep("send_ai_message")} disabled={!workspaces.length} className="btn btn-secondary btn-sm">+ AI message</button>
        </div>

        <button type="submit" disabled={saving || !steps.length} className="btn btn-primary">{saving ? "Creating…" : "Create workflow"}</button>
      </form>
    </AppShell>
  );
}

function WorkflowCard({
  workflow, onChange, onDelete,
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
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{workflow.name}</p>
          <p className="text-xs subtle">
            {workflow.workflow_definition.length} steps · ran {workflow.execution_count}×
            {workflow.last_execution_at ? ` · last ${new Date(workflow.last_execution_at).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={handleRun} disabled={running} className="btn btn-primary btn-sm">{running ? "Running…" : "Run"}</button>
          <button onClick={() => onDelete(workflow.id)} className="btn btn-danger btn-sm">Delete</button>
        </div>
      </div>
      {error && <p className="alert alert-danger mt-3">{error}</p>}
      {lastExecution && (
        <div className="mt-3 rounded-lg border p-2 text-xs" style={{ background: "var(--surface-2)" }}>
          <p className="font-medium" style={{ color: lastExecution.status === "success" ? "var(--success)" : "var(--warning)" }}>
            {lastExecution.status} · {new Date(lastExecution.started_at).toLocaleTimeString()}
          </p>
          {lastExecution.step_results.map((r, i) => (
            <p key={i} style={{ color: r.status === "success" ? "var(--text-muted)" : "var(--danger)" }}>
              {r.type}: {r.status === "success" ? "ok" : r.error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
