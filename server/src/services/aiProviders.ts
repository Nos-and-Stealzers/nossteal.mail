import { decryptSecret } from "../utils/crypto.js";

export interface AiProviderRow {
  id: string;
  provider_type: string;
  model_name: string;
  api_endpoint: string | null;
  api_key_encrypted: string | null;
  max_tokens: number;
  temperature: string | number;
  system_prompt: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResult {
  content: string;
  tokensUsed: number;
}

export async function generateChatCompletion(
  provider: AiProviderRow,
  messages: ChatMessage[]
): Promise<ChatResult> {
  switch (provider.provider_type) {
    case "anthropic":
      return callAnthropic(provider, messages);
    case "openai_compatible":
      return callOpenAiCompatible(provider, messages);
    default:
      throw new Error(`Unsupported provider type: ${provider.provider_type}`);
  }
}

async function callAnthropic(provider: AiProviderRow, messages: ChatMessage[]): Promise<ChatResult> {
  if (!provider.api_key_encrypted) throw new Error("Anthropic provider is missing an API key");
  const apiKey = decryptSecret(provider.api_key_encrypted);

  const nonSystem = messages.filter((m) => m.role !== "system");
  const systemFromHistory = messages.find((m) => m.role === "system")?.content;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model_name,
      max_tokens: provider.max_tokens,
      temperature: Number(provider.temperature),
      system: provider.system_prompt || systemFromHistory || undefined,
      messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage: { input_tokens: number; output_tokens: number };
  };

  const content = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");

  return {
    content,
    tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  };
}

async function callOpenAiCompatible(provider: AiProviderRow, messages: ChatMessage[]): Promise<ChatResult> {
  if (!provider.api_endpoint) throw new Error("Provider is missing an API endpoint");
  const apiKey = provider.api_key_encrypted ? decryptSecret(provider.api_key_encrypted) : null;

  const chatMessages: ChatMessage[] = provider.system_prompt
    ? [{ role: "system", content: provider.system_prompt }, ...messages.filter((m) => m.role !== "system")]
    : messages;

  const res = await fetch(`${provider.api_endpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: provider.model_name,
      max_tokens: provider.max_tokens,
      temperature: Number(provider.temperature),
      messages: chatMessages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Provider API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { total_tokens?: number };
  };

  return {
    content: data.choices?.[0]?.message?.content ?? "",
    tokensUsed: data.usage?.total_tokens ?? 0,
  };
}
