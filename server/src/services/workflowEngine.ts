import { z } from "zod";
import { pool } from "../db/pool.js";
import { generateChatCompletion, type ChatMessage } from "./aiProviders.js";

const stepSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_task"),
    params: z.object({ title: z.string().min(1), description: z.string().optional() }),
  }),
  z.object({
    type: z.literal("create_note"),
    params: z.object({ title: z.string().optional(), content: z.string().optional() }),
  }),
  z.object({
    type: z.literal("send_ai_message"),
    params: z.object({ workspaceId: z.string().uuid(), content: z.string().min(1) }),
  }),
]);

export const workflowDefinitionSchema = z.array(stepSchema).min(1);
export type WorkflowStep = z.infer<typeof stepSchema>;

export interface StepResult {
  type: string;
  status: "success" | "error";
  detail?: unknown;
  error?: string;
}

export async function executeWorkflow(userId: string, steps: WorkflowStep[]): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const step of steps) {
    try {
      switch (step.type) {
        case "create_task": {
          const result = await pool.query(
            `INSERT INTO tasks (user_id, title, description) VALUES ($1,$2,$3) RETURNING id, title`,
            [userId, step.params.title, step.params.description ?? null]
          );
          results.push({ type: step.type, status: "success", detail: result.rows[0] });
          break;
        }
        case "create_note": {
          const result = await pool.query(
            `INSERT INTO notes (user_id, title, content) VALUES ($1,$2,$3) RETURNING id, title`,
            [userId, step.params.title ?? null, step.params.content ?? null]
          );
          results.push({ type: step.type, status: "success", detail: result.rows[0] });
          break;
        }
        case "send_ai_message": {
          results.push(await runSendAiMessage(userId, step.params.workspaceId, step.params.content));
          break;
        }
      }
    } catch (err) {
      results.push({ type: step.type, status: "error", error: (err as Error).message });
    }
  }

  return results;
}

async function runSendAiMessage(
  userId: string,
  workspaceId: string,
  content: string
): Promise<StepResult> {
  const workspaceResult = await pool.query(
    `SELECT w.id, p.* FROM ai_workspaces w JOIN ai_providers p ON p.id = w.ai_provider_id
     WHERE w.id = $1 AND w.user_id = $2`,
    [workspaceId, userId]
  );
  const provider = workspaceResult.rows[0];
  if (!provider) return { type: "send_ai_message", status: "error", error: "Workspace not found" };
  if (provider.is_paused) {
    return { type: "send_ai_message", status: "error", error: "AI provider is paused (emergency stop)" };
  }

  const conversationResult = await pool.query(
    `INSERT INTO conversations (workspace_id, title) VALUES ($1, 'Workflow run') RETURNING id`,
    [workspaceId]
  );
  const conversationId = conversationResult.rows[0].id;

  await pool.query(`INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1,'user',$2)`, [
    conversationId,
    content,
  ]);

  const { content: replyContent, tokensUsed } = await generateChatCompletion(provider, [
    { role: "user", content } as ChatMessage,
  ]);

  await pool.query(
    `INSERT INTO conversation_messages (conversation_id, role, content, tokens_used, model_name)
     VALUES ($1,'assistant',$2,$3,$4)`,
    [conversationId, replyContent, tokensUsed, provider.model_name]
  );
  await pool.query(
    `UPDATE conversations SET message_count = 2, last_message_at = NOW(), total_tokens_used = $2 WHERE id = $1`,
    [conversationId, tokensUsed]
  );

  return { type: "send_ai_message", status: "success", detail: { conversationId, reply: replyContent } };
}
