"use client";

import { useEffect, useState } from "react";
import { api, type AiProvider } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

const emptyForm = {
  name: "",
  providerType: "anthropic" as "anthropic" | "openai_compatible",
  modelName: "claude-sonnet-5",
  apiEndpoint: "",
  apiKey: "",
  maxTokens: 2048,
  temperature: 0.7,
  systemPrompt: "",
};

export default function AiProvidersPage() {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const { providers } = await api.listAiProviders();
    setProviders(providers);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createAiProvider({
        name: form.name,
        providerType: form.providerType,
        modelName: form.modelName,
        apiEndpoint: form.providerType === "openai_compatible" ? form.apiEndpoint : undefined,
        apiKey: form.apiKey || undefined,
        maxTokens: form.maxTokens,
        temperature: form.temperature,
        systemPrompt: form.systemPrompt || undefined,
      });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteAiProvider(id);
    await refresh();
  }

  return (
    <AppShell title="AI providers" maxWidth="44rem">
      <p className="mb-5 text-sm muted">
        No AI is connected by default. Add a provider to enable workspaces — everything stays in manual
        mode until you explicitly enable automation.
      </p>

      {!providers.length ? (
        <div className="empty mb-8">No providers yet. Add one below — a local Ollama model works with no API key.</div>
      ) : (
        <div className="mb-8 space-y-3">
          {providers.map((p) => (
            <ProviderRow key={p.id} provider={p} onChange={refresh} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide subtle">Add provider</h2>
      <form onSubmit={handleSubmit} className="card card-pad">
        {error && <p className="alert alert-danger mb-4">{error}</p>}
        <div className="field">
          <label className="label">Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" placeholder="e.g. Local (Ollama)" />
        </div>
        <div className="field">
          <label className="label">Provider type</label>
          <select value={form.providerType} onChange={(e) => setForm((f) => ({ ...f, providerType: e.target.value as typeof f.providerType }))} className="select">
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai_compatible">OpenAI-compatible (OpenAI, Ollama, LM Studio…)</option>
          </select>
        </div>
        <div className="field">
          <label className="label">Model name</label>
          <input required value={form.modelName} onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))} className="input" placeholder={form.providerType === "anthropic" ? "claude-sonnet-5" : "gpt-4o / llama3:latest / …"} />
        </div>
        {form.providerType === "openai_compatible" && (
          <div className="field">
            <label className="label">API endpoint</label>
            <input required value={form.apiEndpoint} onChange={(e) => setForm((f) => ({ ...f, apiEndpoint: e.target.value }))} className="input" placeholder="https://api.openai.com/v1 or http://localhost:11434/v1" />
          </div>
        )}
        <div className="field">
          <label className="label">API key <span className="subtle">(blank for keyless local models)</span></label>
          <input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} className="input" />
        </div>
        <div className="field">
          <label className="label">System prompt <span className="subtle">(optional)</span></label>
          <textarea rows={3} value={form.systemPrompt} onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))} className="textarea" />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Add provider"}</button>
      </form>
    </AppShell>
  );
}

function ProviderRow({
  provider, onChange, onDelete,
}: {
  provider: AiProvider;
  onChange: () => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleModeChange(mode: "manual" | "assisted" | "full") {
    setError(null);
    if (mode === "full") {
      const confirmed = window.confirm(
        "Full Automation lets this AI send email, delete messages, and act without prompting you first. " +
          "Every action is logged and can be undone for 30 days, and you can hit Pause at any time. Enable it?"
      );
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      await api.setAutomationMode(provider.id, mode, mode === "full" ? true : undefined);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    setBusy(true);
    setError(null);
    try {
      if (provider.is_paused) await api.resumeProvider(provider.id);
      else await api.pauseProvider(provider.id);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{provider.name}</p>
          <p className="text-xs subtle">{provider.provider_type} · {provider.model_name}</p>
        </div>
        <button onClick={() => onDelete(provider.id)} className="btn btn-danger btn-sm">Remove</button>
      </div>
      {error && <p className="alert alert-danger mt-3">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={provider.automation_mode}
          disabled={busy}
          onChange={(e) => handleModeChange(e.target.value as "manual" | "assisted" | "full")}
          className="select"
          style={{ maxWidth: "22rem" }}
        >
          <option value="manual">Manual — nothing without approval</option>
          <option value="assisted">Assisted — approved categories run</option>
          <option value="full">Full — acts unattended within permissions</option>
        </select>
        {provider.automation_mode !== "manual" && (
          <button onClick={togglePause} disabled={busy} className={`btn btn-sm ${provider.is_paused ? "btn-secondary" : "btn-danger"}`}>
            {provider.is_paused ? "Resume" : "Emergency stop"}
          </button>
        )}
        {provider.is_paused && <span className="badge badge-danger">Paused</span>}
      </div>
    </div>
  );
}
