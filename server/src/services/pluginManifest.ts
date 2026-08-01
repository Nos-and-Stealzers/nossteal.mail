import { z } from "zod";

export const KNOWN_PERMISSIONS = [
  "read_email",
  "write_email",
  "use_ai",
  "access_filesystem",
  "network_access",
  "background_tasks",
] as const;

export const pluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  repository: z.string().url().optional(),

  category: z.enum([
    "ai_provider",
    "mcp_server",
    "theme",
    "automation",
    "workflow",
    "productivity",
    "developer",
  ]),
  type: z.enum(["node_module", "python_package", "static", "custom"]).optional(),

  permissions: z.array(z.string()).default([]),
  entry_point: z.string().optional(),

  configuration: z.record(z.string(), z.unknown()).optional(),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function assertPublicManifestUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Manifest URL must be http(s)");
  }
  if (BLOCKED_HOSTNAME_PATTERNS.some((p) => p.test(parsed.hostname))) {
    throw new Error("Manifest URL must not point to a local/internal address");
  }
}

export async function fetchManifest(url: string): Promise<PluginManifest> {
  assertPublicManifestUrl(url);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!res.ok) throw new Error(`Failed to fetch manifest (${res.status})`);
  const json = await res.json();
  return pluginManifestSchema.parse(json);
}
