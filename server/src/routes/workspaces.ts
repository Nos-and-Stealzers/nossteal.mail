import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { generateChatCompletion, type ChatMessage } from "../services/aiProviders.js";

export const workspacesRouter = Router();
workspacesRouter.use(requireAuth);

const createWorkspaceSchema = z.object({
  aiProviderId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
});

workspacesRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT w.id, w.name, w.description, w.ai_provider_id, p.name AS provider_name,
            w.conversation_count, w.message_count, w.created_at
     FROM ai_workspaces w
     JOIN ai_providers p ON p.id = w.ai_provider_id
     WHERE w.user_id = $1 ORDER BY w.created_at ASC`,
    [req.userId]
  );
  res.json({ workspaces: result.rows });
});

workspacesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const w = parsed.data;

  const providerCheck = await pool.query(
    "SELECT id FROM ai_providers WHERE id = $1 AND user_id = $2",
    [w.aiProviderId, req.userId]
  );
  if (!providerCheck.rowCount) return res.status(404).json({ error: "AI provider not found" });

  const result = await pool.query(
    `INSERT INTO ai_workspaces (user_id, ai_provider_id, name, description)
     VALUES ($1,$2,$3,$4) RETURNING id, name, description, ai_provider_id, created_at`,
    [req.userId, w.aiProviderId, w.name, w.description ?? null]
  );
  res.status(201).json({ workspace: result.rows[0] });
});

workspacesRouter.get("/:id/conversations", async (req: AuthedRequest, res) => {
  const workspace = await getOwnedWorkspace(req.params.id, req.userId!);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });

  const result = await pool.query(
    `SELECT id, title, is_archived, is_pinned, message_count, last_message_at, created_at
     FROM conversations WHERE workspace_id = $1 ORDER BY COALESCE(last_message_at, created_at) DESC`,
    [workspace.id]
  );
  res.json({ conversations: result.rows });
});

workspacesRouter.post("/:id/conversations", async (req: AuthedRequest, res) => {
  const workspace = await getOwnedWorkspace(req.params.id, req.userId!);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });

  const title = typeof req.body?.title === "string" ? req.body.title : "New conversation";
  const result = await pool.query(
    `INSERT INTO conversations (workspace_id, title) VALUES ($1,$2)
     RETURNING id, title, created_at`,
    [workspace.id, title]
  );
  await pool.query(
    "UPDATE ai_workspaces SET conversation_count = conversation_count + 1 WHERE id = $1",
    [workspace.id]
  );
  res.status(201).json({ conversation: result.rows[0] });
});

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

conversationsRouter.get("/:id/messages", async (req: AuthedRequest, res) => {
  const conversation = await getOwnedConversation(req.params.id, req.userId!);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });

  const result = await pool.query(
    `SELECT id, role, content, tokens_used, model_name, created_at
     FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversation.id]
  );
  res.json({ messages: result.rows });
});

const sendMessageSchema = z.object({ content: z.string().min(1) });

conversationsRouter.post("/:id/messages", async (req: AuthedRequest, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const conversation = await getOwnedConversation(req.params.id, req.userId!);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });

  const providerResult = await pool.query(
    `SELECT p.* FROM ai_providers p
     JOIN ai_workspaces w ON w.ai_provider_id = p.id
     WHERE w.id = $1`,
    [conversation.workspace_id]
  );
  const provider = providerResult.rows[0];
  if (!provider) return res.status(404).json({ error: "AI provider not found for this workspace" });
  if (provider.is_paused) {
    return res.status(423).json({ error: "This AI provider is paused (emergency stop is active)" });
  }

  await pool.query(
    `INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1,'user',$2)`,
    [conversation.id, parsed.data.content]
  );

  const historyResult = await pool.query(
    `SELECT role, content FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversation.id]
  );
  const history = historyResult.rows as ChatMessage[];

  try {
    const { content, tokensUsed } = await generateChatCompletion(provider, history);

    const assistantResult = await pool.query(
      `INSERT INTO conversation_messages (conversation_id, role, content, tokens_used, model_name)
       VALUES ($1,'assistant',$2,$3,$4)
       RETURNING id, role, content, tokens_used, model_name, created_at`,
      [conversation.id, content, tokensUsed, provider.model_name]
    );

    await pool.query(
      `UPDATE conversations SET message_count = message_count + 2, last_message_at = NOW(),
              total_tokens_used = total_tokens_used + $2 WHERE id = $1`,
      [conversation.id, tokensUsed]
    );
    await pool.query(
      `UPDATE ai_workspaces SET message_count = message_count + 2 WHERE id = $1`,
      [conversation.workspace_id]
    );
    await pool.query("UPDATE ai_providers SET last_used = NOW() WHERE id = $1", [provider.id]);

    res.status(201).json({ message: assistantResult.rows[0] });
  } catch (err) {
    res.status(502).json({ error: "AI provider request failed", detail: (err as Error).message });
  }
});

async function getOwnedWorkspace(id: string, userId: string) {
  const result = await pool.query("SELECT * FROM ai_workspaces WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  return result.rows[0] ?? null;
}

async function getOwnedConversation(id: string, userId: string) {
  const result = await pool.query(
    `SELECT c.* FROM conversations c
     JOIN ai_workspaces w ON w.id = c.workspace_id
     WHERE c.id = $1 AND w.user_id = $2`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}
