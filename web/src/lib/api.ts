const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface User {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  is_admin: boolean;
}

export const api = {
  register: (email: string, password: string, fullName?: string, username?: string) =>
    request<{ user: User; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName, username }),
    }),

  login: (identifier: string, password: string) =>
    request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),

  getAdminStats: () => request<{ stats: AdminStats }>("/api/admin/stats"),
  listAdminUsers: () => request<{ users: AdminUser[] }>("/api/admin/users"),
  setUserAdmin: (id: string, isAdmin: boolean) =>
    request<{ user: AdminUser }>(`/api/admin/users/${id}/admin`, {
      method: "PATCH",
      body: JSON.stringify({ isAdmin }),
    }),

  listAccounts: () =>
    request<{ accounts: EmailAccountSummary[] }>("/api/email-accounts"),

  createAccount: (payload: CreateAccountPayload) =>
    request<{ account: EmailAccountSummary }>("/api/email-accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  syncAccount: (id: string) =>
    request<{ synced: number }>(`/api/email-accounts/${id}/sync`, { method: "POST" }),

  listMessages: (folder = "INBOX") =>
    request<{ messages: MessageSummary[] }>(`/api/messages?folder=${encodeURIComponent(folder)}`),

  getMessage: (id: string) => request<{ message: MessageDetail }>(`/api/messages/${id}`),

  sendMessage: (payload: SendMessagePayload) =>
    request<{ messageId: string }>("/api/messages/send", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listAiProviders: () => request<{ providers: AiProvider[] }>("/api/ai-providers"),

  createAiProvider: (payload: CreateAiProviderPayload) =>
    request<{ provider: AiProvider }>("/api/ai-providers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteAiProvider: (id: string) =>
    request<void>(`/api/ai-providers/${id}`, { method: "DELETE" }),

  listWorkspaces: () => request<{ workspaces: Workspace[] }>("/api/workspaces"),

  createWorkspace: (payload: { aiProviderId: string; name: string; description?: string }) =>
    request<{ workspace: Workspace }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listConversations: (workspaceId: string) =>
    request<{ conversations: Conversation[] }>(`/api/workspaces/${workspaceId}/conversations`),

  createConversation: (workspaceId: string, title?: string) =>
    request<{ conversation: Conversation }>(`/api/workspaces/${workspaceId}/conversations`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  listConversationMessages: (conversationId: string) =>
    request<{ messages: ConversationMessage[] }>(`/api/conversations/${conversationId}/messages`),

  sendConversationMessage: (conversationId: string, content: string) =>
    request<{ message: ConversationMessage }>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  setAutomationMode: (providerId: string, mode: "manual" | "assisted" | "full", confirmFullAutomation?: boolean) =>
    request<{ provider: AiProvider }>(`/api/ai-providers/${providerId}/automation-mode`, {
      method: "PATCH",
      body: JSON.stringify({ mode, confirmFullAutomation }),
    }),

  pauseProvider: (providerId: string) =>
    request<{ provider: AiProvider }>(`/api/ai-providers/${providerId}/pause`, { method: "POST" }),

  resumeProvider: (providerId: string) =>
    request<{ provider: AiProvider }>(`/api/ai-providers/${providerId}/resume`, { method: "POST" }),

  listMcpServers: () => request<{ servers: McpServer[] }>("/api/mcp-servers"),

  createMcpServer: (payload: { name: string; connectionUrl: string }) =>
    request<{ server: McpServer }>("/api/mcp-servers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteMcpServer: (id: string) => request<void>(`/api/mcp-servers/${id}`, { method: "DELETE" }),

  connectMcpServer: (id: string) =>
    request<{ connected: boolean; tools: { name: string; description?: string }[] }>(
      `/api/mcp-servers/${id}/connect`,
      { method: "POST" }
    ),

  listPlugins: () => request<{ plugins: InstalledPlugin[] }>("/api/plugins"),

  installPluginFromUrl: (manifestUrl: string) =>
    request<{ plugin: InstalledPlugin }>("/api/plugins/install", {
      method: "POST",
      body: JSON.stringify({ manifestUrl }),
    }),

  installPluginFromManifest: (manifest: unknown) =>
    request<{ plugin: InstalledPlugin }>("/api/plugins/install", {
      method: "POST",
      body: JSON.stringify({ manifest }),
    }),

  uninstallPlugin: (id: string) => request<void>(`/api/plugins/${id}`, { method: "DELETE" }),

  setPluginEnabled: (id: string, isEnabled: boolean) =>
    request<{ plugin: { id: string; is_enabled: boolean } }>(`/api/plugins/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isEnabled }),
    }),

  listPluginPermissions: (id: string) =>
    request<{ permissions: PluginPermission[] }>(`/api/plugins/${id}/permissions`),

  grantPluginPermission: (id: string, permission: string) =>
    request<{ permission: PluginPermission }>(`/api/plugins/${id}/permissions/${permission}/grant`, {
      method: "POST",
    }),

  revokePluginPermission: (id: string, permission: string) =>
    request<{ permission: PluginPermission }>(`/api/plugins/${id}/permissions/${permission}/revoke`, {
      method: "POST",
    }),

  listNotes: () => request<{ notes: Note[] }>("/api/notes"),
  createNote: (payload: { title?: string; content?: string }) =>
    request<{ note: Note }>("/api/notes", { method: "POST", body: JSON.stringify(payload) }),
  deleteNote: (id: string) => request<void>(`/api/notes/${id}`, { method: "DELETE" }),

  listTasks: () => request<{ tasks: Task[] }>("/api/tasks"),
  createTask: (payload: { title: string; description?: string }) =>
    request<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: string, payload: { isDone?: boolean }) =>
    request<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),

  listWorkflows: () => request<{ workflows: Workflow[] }>("/api/workflows"),
  createWorkflow: (payload: { name: string; description?: string; steps: WorkflowStep[] }) =>
    request<{ workflow: Workflow }>("/api/workflows", { method: "POST", body: JSON.stringify(payload) }),
  deleteWorkflow: (id: string) => request<void>(`/api/workflows/${id}`, { method: "DELETE" }),
  runWorkflow: (id: string) =>
    request<{ execution: WorkflowExecution }>(`/api/workflows/${id}/run`, { method: "POST" }),
  listWorkflowExecutions: (id: string) =>
    request<{ executions: WorkflowExecution[] }>(`/api/workflows/${id}/executions`),

  listPlans: () => request<{ plans: SubscriptionPlan[] }>("/api/billing/plans"),
  getSubscription: () => request<{ subscription: Subscription }>("/api/billing/subscription"),
  createCheckoutSession: (planId: string, successUrl: string, cancelUrl: string) =>
    request<{ checkoutUrl: string }>("/api/billing/checkout-session", {
      method: "POST",
      body: JSON.stringify({ planId, successUrl, cancelUrl }),
    }),
  createPortalSession: (returnUrl: string) =>
    request<{ portalUrl: string }>("/api/billing/portal-session", {
      method: "POST",
      body: JSON.stringify({ returnUrl }),
    }),

  listDomains: () => request<{ domains: Domain[] }>("/api/domains"),
  createDomain: (domainName: string) =>
    request<{ domain: Domain }>("/api/domains", { method: "POST", body: JSON.stringify({ domainName }) }),
  deleteDomain: (id: string) => request<void>(`/api/domains/${id}`, { method: "DELETE" }),

  createNativeAccount: (payload: { domainId: string; localPart: string; displayName?: string }) =>
    request<{ account: EmailAccountSummary }>("/api/email-accounts", {
      method: "POST",
      body: JSON.stringify({ kind: "native", ...payload }),
    }),
};

export interface AiProvider {
  id: string;
  name: string;
  provider_type: "anthropic" | "openai_compatible";
  model_name: string;
  api_endpoint: string | null;
  max_tokens: number;
  temperature: string;
  system_prompt: string | null;
  automation_mode: "manual" | "assisted" | "full";
  is_paused: boolean;
  is_active: boolean;
  last_used: string | null;
  created_at: string;
}

export interface InstalledPlugin {
  id: string;
  plugin_id: string;
  plugin_name: string;
  plugin_version: string | null;
  plugin_type: string;
  source: string;
  source_url: string | null;
  is_enabled: boolean;
  requested_permissions: string[];
  plugin_configuration: Record<string, unknown>;
  last_used: string | null;
  installed_at: string;
}

export interface PluginPermission {
  permission: string;
  granted: boolean;
  granted_at: string | null;
}

export interface Note {
  id: string;
  title: string | null;
  content: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  is_done: boolean;
  due_date: string | null;
  created_at: string;
}

export type WorkflowStep =
  | { type: "create_task"; params: { title: string; description?: string } }
  | { type: "create_note"; params: { title?: string; content?: string } }
  | { type: "send_ai_message"; params: { workspaceId: string; content: string } };

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  trigger_type: string;
  workflow_definition: WorkflowStep[];
  execution_count: number;
  success_count: number;
  failure_count: number;
  last_execution_at: string | null;
  created_at: string;
}

export interface WorkflowExecution {
  id: string;
  status: "success" | "failed" | "partial";
  step_results: { type: string; status: "success" | "error"; detail?: unknown; error?: string }[];
  started_at: string;
  finished_at: string | null;
}

export interface AdminStats {
  users: number;
  messages: number;
  aiProviders: number;
  workflows: number;
  domains: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  account_type: string;
  subscription_status: string;
  is_admin: boolean;
  created_at: string;
}

export interface DnsRecord {
  type: string;
  host: string;
  value: string;
  note: string;
}

export interface Domain {
  id: string;
  domain_name: string;
  dkim_selector: string;
  dkim_public_key_pem: string;
  created_at: string;
  dns_records: DnsRecord[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  storage_limit_bytes: string;
  features: string[];
  sort_order: number;
}

export interface Subscription {
  account_type: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  plan_name: string;
  price_cents: number;
  storage_limit_bytes: string;
  features: string[];
}

export interface McpServer {
  id: string;
  name: string;
  connection_url: string;
  is_connected: boolean;
  last_connected_at: string | null;
  connection_error: string | null;
  server_version: string | null;
  tools_count: number;
  created_at: string;
}

export interface CreateAiProviderPayload {
  name: string;
  providerType: "anthropic" | "openai_compatible";
  modelName: string;
  apiEndpoint?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  ai_provider_id: string;
  provider_name: string;
  conversation_count: number;
  message_count: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_used: number;
  model_name: string | null;
  created_at: string;
}

export interface EmailAccountSummary {
  id: string;
  email_address: string;
  display_name: string | null;
  account_kind: "external" | "native";
  imap_host: string | null;
  smtp_host: string | null;
  is_default: boolean;
  last_sync: string | null;
  created_at: string;
}

export interface CreateAccountPayload {
  emailAddress: string;
  displayName?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
}

export interface MessageSummary {
  id: string;
  from_address: string | null;
  to_addresses: string[] | null;
  subject: string | null;
  date_received: string | null;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
}

export interface MessageDetail extends MessageSummary {
  body_html: string | null;
  body_plaintext: string | null;
  cc_addresses: string[] | null;
  in_reply_to: string | null;
}

export interface SendMessagePayload {
  emailAccountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string;
}
