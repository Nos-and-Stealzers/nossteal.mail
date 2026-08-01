CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),

  imap_host VARCHAR(255) NOT NULL,
  imap_port INTEGER NOT NULL,
  imap_secure BOOLEAN DEFAULT TRUE,
  imap_username VARCHAR(255) NOT NULL,
  imap_password_encrypted TEXT NOT NULL,

  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INTEGER NOT NULL,
  smtp_secure BOOLEAN DEFAULT TRUE,
  smtp_username VARCHAR(255) NOT NULL,
  smtp_password_encrypted TEXT NOT NULL,

  is_default BOOLEAN DEFAULT FALSE,
  last_sync TIMESTAMP,
  last_uid INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, email_address)
);

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  last_message_date TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES message_threads(id) ON DELETE SET NULL,

  message_id VARCHAR(998),
  from_address VARCHAR(255),
  to_addresses TEXT[],
  cc_addresses TEXT[],
  subject TEXT,
  date_sent TIMESTAMP,
  date_received TIMESTAMP,

  body_html TEXT,
  body_plaintext TEXT,

  in_reply_to VARCHAR(998),
  imap_uid INTEGER,
  folder VARCHAR(100) DEFAULT 'INBOX',

  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_draft BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,

  has_attachments BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (email_account_id, folder, imap_uid)
);

CREATE INDEX IF NOT EXISTS idx_messages_user_date ON messages (user_id, date_received DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_id);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  storage_key VARCHAR(500),
  is_inline BOOLEAN DEFAULT FALSE,
  content_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI Framework & Provider System

CREATE TABLE IF NOT EXISTS ai_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(50) NOT NULL, -- 'anthropic', 'openai_compatible'
  model_name VARCHAR(255) NOT NULL,

  api_endpoint VARCHAR(500), -- required for openai_compatible / local providers
  api_key_encrypted TEXT,    -- null for providers that don't require a key (e.g. local Ollama)

  max_tokens INTEGER DEFAULT 2048,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  system_prompt TEXT,

  -- Automation mode: manual is the only mode wired up so far; assisted/full are reserved
  automation_mode VARCHAR(50) DEFAULT 'manual',

  is_active BOOLEAN DEFAULT TRUE,
  last_used TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS ai_workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,

  conversation_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, ai_provider_id, name)
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES ai_workspaces(id) ON DELETE CASCADE,

  title VARCHAR(500),
  is_archived BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,

  message_count INTEGER DEFAULT 0,
  total_tokens_used BIGINT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations (workspace_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  role VARCHAR(50) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,

  tokens_used INTEGER DEFAULT 0,
  model_name VARCHAR(255),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv ON conversation_messages (conversation_id, created_at ASC);

-- Automation Modes

CREATE TABLE IF NOT EXISTS automation_action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ai_provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL, -- 'mode_changed', 'mode_paused', 'mode_resumed'
  details JSONB,
  performed_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_provider ON automation_action_logs (ai_provider_id, created_at DESC);

ALTER TABLE ai_providers ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_providers ADD COLUMN IF NOT EXISTS full_auto_enabled_at TIMESTAMP;
ALTER TABLE ai_providers ADD COLUMN IF NOT EXISTS full_auto_enabled_by_user_id UUID REFERENCES users(id);

-- MCP Integration

CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  connection_url VARCHAR(500) NOT NULL, -- SSE/HTTP MCP endpoint

  is_connected BOOLEAN DEFAULT FALSE,
  last_connected_at TIMESTAMP,
  connection_error TEXT,

  server_version VARCHAR(50),
  tools_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS mcp_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  input_schema JSONB,

  is_enabled BOOLEAN DEFAULT TRUE,
  usage_count BIGINT DEFAULT 0,
  last_used_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (mcp_server_id, name)
);

CREATE TABLE IF NOT EXISTS ai_provider_mcp_server_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ai_provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (ai_provider_id, mcp_server_id)
);

CREATE TABLE IF NOT EXISTS mcp_tool_invocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ai_provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  mcp_tool_id UUID NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  input_parameters JSONB,
  output_result JSONB,
  status VARCHAR(50) NOT NULL, -- 'success', 'error'
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_invocations_provider ON mcp_tool_invocations (ai_provider_id, created_at DESC);

-- Plugin System
--
-- This layer manages plugin manifests, install state, and explicit per-permission
-- grants. It intentionally does NOT execute plugin code — sandboxing untrusted
-- third-party JS is a separate, dedicated security project. Plugins are inert
-- registry entries until a future runtime is built to actually load them.

CREATE TABLE IF NOT EXISTS installed_plugins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  plugin_id VARCHAR(255) NOT NULL,
  plugin_name VARCHAR(255) NOT NULL,
  plugin_version VARCHAR(50),
  plugin_type VARCHAR(50) NOT NULL, -- category from manifest: ai_provider, mcp_server, theme, automation, workflow, productivity, developer

  source VARCHAR(50) DEFAULT 'manifest_url', -- 'manifest_url', 'manual_json'
  source_url VARCHAR(500),
  manifest JSONB NOT NULL,

  is_enabled BOOLEAN DEFAULT FALSE, -- disabled until permissions are explicitly granted
  requested_permissions TEXT[] DEFAULT '{}',

  plugin_configuration JSONB DEFAULT '{}',

  last_used TIMESTAMP,
  installed_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, plugin_id)
);

CREATE TABLE IF NOT EXISTS plugin_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installed_plugin_id UUID NOT NULL REFERENCES installed_plugins(id) ON DELETE CASCADE,

  permission VARCHAR(100) NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at TIMESTAMP,
  granted_by_user_id UUID REFERENCES users(id),

  UNIQUE (installed_plugin_id, permission)
);

CREATE TABLE IF NOT EXISTS plugin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installed_plugin_id UUID NOT NULL REFERENCES installed_plugins(id) ON DELETE CASCADE,

  log_level VARCHAR(20) NOT NULL, -- 'debug', 'info', 'warn', 'error'
  message TEXT NOT NULL,
  context JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_logs_plugin ON plugin_logs (installed_plugin_id, created_at DESC);

-- Productivity Features

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(500),
  content TEXT,
  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(500) NOT NULL,
  description TEXT,
  is_done BOOLEAN DEFAULT FALSE,
  due_date TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks (user_id, is_done, due_date);

-- Workflow & Automation Builder
--
-- workflow_definition is an ordered array of typed action steps, e.g.
-- [{"type":"create_task","params":{"title":"..."}}, {"type":"send_ai_message","params":{"workspaceId":"...","content":"..."}}]
-- Only the 'manual' trigger actually runs a workflow today (via POST /run) — 'schedule'
-- and 'email_received' triggers need a background job runner that doesn't exist yet,
-- so they're accepted for storage but never fire on their own.

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,

  trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'manual', 'schedule', 'email_received' (latter two inert)
  trigger_configuration JSONB DEFAULT '{}',
  workflow_definition JSONB NOT NULL DEFAULT '[]',

  execution_count BIGINT DEFAULT 0,
  success_count BIGINT DEFAULT 0,
  failure_count BIGINT DEFAULT 0,
  last_execution_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial'
  step_results JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,

  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions (workflow_id, started_at DESC);

-- Subscription Plans & Billing

CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(50) PRIMARY KEY, -- 'free', 'silver', 'gold', 'super_nos'
  name VARCHAR(100) NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  stripe_price_id VARCHAR(255), -- null for the free plan
  storage_limit_bytes BIGINT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO subscription_plans (id, name, price_cents, storage_limit_bytes, features, sort_order) VALUES
  ('free', 'Free', 0, 2147483648, '["1 email account", "Manual AI mode only", "5 AI workspaces"]', 0),
  ('silver', 'Silver', 900, 16106127360, '["5 email accounts", "Assisted automation", "Unlimited AI workspaces"]', 1),
  ('gold', 'Gold', 2400, 53687091200, '["Unlimited email accounts", "Full automation", "Priority support"]', 2),
  ('super_nos', 'Super Nos', 4900, 214748364800, '["Everything in Gold", "Dedicated MCP hosting", "White-glove onboarding"]', 3)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) NOT NULL DEFAULT 'free' REFERENCES subscription_plans(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active'; -- 'active','paused','cancelled','past_due'
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Native Mail (self-hosted, direct-to-MX send/receive on the user's own domain)
--
-- A 'domain' holds a generated DKIM keypair; the public half + a recommended SPF/DMARC
-- policy are surfaced to the user to publish as DNS TXT records themselves (DNS hosting
-- is out of this app's control). email_accounts of kind 'native' represent an address on
-- one of these domains — mail arrives via the inbound SMTP receiver (server/src/mailserver)
-- and is written straight into `messages`; outbound goes through directMailSender.ts,
-- which resolves each recipient's MX and connects to it directly, DKIM-signing with the
-- domain's key. Real inbound delivery requires deploying the receiver on a host with a
-- public IP, matching PTR record, and port 25 open — none of which exist in a dev sandbox.

CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  domain_name VARCHAR(255) NOT NULL,
  dkim_selector VARCHAR(63) NOT NULL DEFAULT 'nossteal',
  dkim_private_key_encrypted TEXT NOT NULL,
  dkim_public_key_pem TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, domain_name)
);

ALTER TABLE email_accounts ALTER COLUMN imap_host DROP NOT NULL;
ALTER TABLE email_accounts ALTER COLUMN imap_port DROP NOT NULL;
ALTER TABLE email_accounts ALTER COLUMN imap_username DROP NOT NULL;
ALTER TABLE email_accounts ALTER COLUMN imap_password_encrypted DROP NOT NULL;
ALTER TABLE email_accounts ALTER COLUMN smtp_host DROP NOT NULL;
ALTER TABLE email_accounts ALTER COLUMN smtp_port DROP NOT NULL;
ALTER TABLE email_accounts ALTER COLUMN smtp_username DROP NOT NULL;
ALTER TABLE email_accounts ALTER COLUMN smtp_password_encrypted DROP NOT NULL;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS account_kind VARCHAR(20) NOT NULL DEFAULT 'external'; -- 'external', 'native'
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE CASCADE;

-- Admin

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Free-form per-user settings (AI defaults, appearance, etc.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Per-mailbox storage quotas and AI sub-mailbox support.
-- AI sub-mailboxes are small scratch inboxes an assistant can own; regular
-- mailboxes get a larger quota that scales with the account's plan.
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NOT NULL DEFAULT 1073741824; -- 1 GB
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS is_ai_managed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS ai_provider_id UUID REFERENCES ai_providers(id) ON DELETE SET NULL;
