"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type AiProvider } from "@/lib/api";

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
  const { loading } = useAuth();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    refresh();
  }, [loading]);

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
          <h1 className="mb-3 text-xl font-semibold">AI providers</h1>
          <p className="mb-4 text-sm text-neutral-500">
            No AI is connected by default. Add a provider to enable AI workspaces — everything stays in manual
            mode until you explicitly enable automation.
          </p>
          {!providers.length ? (
            <p className="text-neutral-500">No providers connected yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
              {providers.map((p) => (
                <ProviderRow key={p.id} provider={p} onChange={refresh} onDelete={handleDelete} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Add provider</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Provider type</label>
              <select
                value={form.providerType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, providerType: e.target.value as typeof f.providerType }))
                }
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai_compatible">OpenAI-compatible (OpenAI, Ollama, LM Studio, etc.)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Model name</label>
              <input
                required
                value={form.modelName}
                onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                placeholder={form.providerType === "anthropic" ? "claude-sonnet-5" : "gpt-4o / llama3 / ..."}
              />
            </div>
            {form.providerType === "openai_compatible" && (
              <div className="space-y-1">
                <label className="text-sm text-neutral-400">API endpoint</label>
                <input
                  required
                  value={form.apiEndpoint}
                  onChange={(e) => setForm((f) => ({ ...f, apiEndpoint: e.target.value }))}
                  placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">API key (leave blank for keyless local models)</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">System prompt (optional)</label>
              <textarea
                rows={3}
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add provider"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function ProviderRow({
  provider,
  onChange,
  onDelete,
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
    <li className="px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{provider.name}</p>
          <p className="text-neutral-500">
            {provider.provider_type} · {provider.model_name}
          </p>
        </div>
        <button onClick={() => onDelete(provider.id)} className="text-red-400 hover:underline">
          Remove
        </button>
      </div>
      {error && <p className="mt-2 rounded bg-red-950 p-2 text-xs text-red-300">{error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <select
          value={provider.automation_mode}
          disabled={busy}
          onChange={(e) => handleModeChange(e.target.value as "manual" | "assisted" | "full")}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
        >
          <option value="manual">Manual — nothing happens without your approval</option>
          <option value="assisted">Assisted — approved categories run automatically</option>
          <option value="full">Full Automation — acts unattended within granted permissions</option>
        </select>
        {provider.automation_mode !== "manual" && (
          <button
            onClick={togglePause}
            disabled={busy}
            className={`rounded px-2 py-1 text-xs font-medium ${
              provider.is_paused ? "bg-emerald-700 hover:bg-emerald-600" : "bg-amber-700 hover:bg-amber-600"
            }`}
          >
            {provider.is_paused ? "Resume" : "Emergency stop"}
          </button>
        )}
        {provider.is_paused && <span className="text-xs text-amber-400">Paused</span>}
      </div>
    </li>
  );
}
