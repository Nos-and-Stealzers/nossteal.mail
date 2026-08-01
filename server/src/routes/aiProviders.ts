import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { encryptSecret } from "../utils/crypto.js";

export const aiProvidersRouter = Router();
aiProvidersRouter.use(requireAuth);

const createProviderSchema = z.object({
  name: z.string().min(1),
  providerType: z.enum(["anthropic", "openai_compatible"]),
  modelName: z.string().min(1),
  apiEndpoint: z.string().url().optional(),
  apiKey: z.string().optional(),
  maxTokens: z.number().int().positive().default(2048),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().optional(),
});

aiProvidersRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, name, provider_type, model_name, api_endpoint, max_tokens, temperature,
            system_prompt, automation_mode, is_paused, is_active, last_used, created_at
     FROM ai_providers WHERE user_id = $1 ORDER BY created_at ASC`,
    [req.userId]
  );
  res.json({ providers: result.rows });
});

aiProvidersRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const p = parsed.data;

  if (p.providerType === "openai_compatible" && !p.apiEndpoint) {
    return res.status(400).json({ error: "apiEndpoint is required for openai_compatible providers" });
  }

  const result = await pool.query(
    `INSERT INTO ai_providers (
       user_id, name, provider_type, model_name, api_endpoint, api_key_encrypted,
       max_tokens, temperature, system_prompt
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, name, provider_type, model_name, api_endpoint, max_tokens, temperature,
               system_prompt, automation_mode, is_active, created_at`,
    [
      req.userId,
      p.name,
      p.providerType,
      p.modelName,
      p.apiEndpoint ?? null,
      p.apiKey ? encryptSecret(p.apiKey) : null,
      p.maxTokens,
      p.temperature,
      p.systemPrompt ?? null,
    ]
  );
  res.status(201).json({ provider: result.rows[0] });
});

aiProvidersRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query("DELETE FROM ai_providers WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  res.status(204).send();
});

const setModeSchema = z.object({
  mode: z.enum(["manual", "assisted", "full"]),
  confirmFullAutomation: z.boolean().optional(),
});

// Automation Modes: manual (default, no autonomous action), assisted (approved
// categories run without per-action prompts), full (everything the owner has
// permitted runs unattended). Switching to 'full' requires an explicit
// confirmation flag from the client, mirroring the spec's consent-screen
// requirement, and is recorded in automation_action_logs for audit/undo.
aiProvidersRouter.patch("/:id/automation-mode", async (req: AuthedRequest, res) => {
  const parsed = setModeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { mode, confirmFullAutomation } = parsed.data;

  const providerResult = await pool.query(
    "SELECT id, automation_mode FROM ai_providers WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  const provider = providerResult.rows[0];
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  if (mode === "full" && !confirmFullAutomation) {
    return res.status(400).json({
      error:
        "Enabling Full Automation requires confirmFullAutomation: true — this grants the AI unattended send/delete/organize capability.",
    });
  }

  const isEnablingFull = mode === "full" && provider.automation_mode !== "full";
  const result = await pool.query(
    `UPDATE ai_providers SET
       automation_mode = $1,
       full_auto_enabled_at = CASE WHEN $2 THEN NOW() ELSE full_auto_enabled_at END,
       full_auto_enabled_by_user_id = CASE WHEN $2 THEN $3 ELSE full_auto_enabled_by_user_id END,
       updated_at = NOW()
     WHERE id = $4
     RETURNING id, name, automation_mode, is_paused, full_auto_enabled_at`,
    [mode, isEnablingFull, req.userId, provider.id]
  );

  await pool.query(
    `INSERT INTO automation_action_logs (ai_provider_id, action_type, details, performed_by_user_id)
     VALUES ($1, 'mode_changed', $2, $3)`,
    [provider.id, JSON.stringify({ from: provider.automation_mode, to: mode }), req.userId]
  );

  res.json({ provider: result.rows[0] });
});

// Emergency stop: immediately halts all automation for this provider without changing its mode,
// so re-enabling doesn't require re-confirming Full Automation.
aiProvidersRouter.post("/:id/pause", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `UPDATE ai_providers SET is_paused = TRUE, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING id, is_paused`,
    [req.params.id, req.userId]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Provider not found" });

  await pool.query(
    `INSERT INTO automation_action_logs (ai_provider_id, action_type, performed_by_user_id)
     VALUES ($1, 'mode_paused', $2)`,
    [req.params.id, req.userId]
  );
  res.json({ provider: result.rows[0] });
});

aiProvidersRouter.post("/:id/resume", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `UPDATE ai_providers SET is_paused = FALSE, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING id, is_paused`,
    [req.params.id, req.userId]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Provider not found" });

  await pool.query(
    `INSERT INTO automation_action_logs (ai_provider_id, action_type, performed_by_user_id)
     VALUES ($1, 'mode_resumed', $2)`,
    [req.params.id, req.userId]
  );
  res.json({ provider: result.rows[0] });
});

aiProvidersRouter.get("/:id/automation-logs", async (req: AuthedRequest, res) => {
  const ownerCheck = await pool.query("SELECT id FROM ai_providers WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  if (!ownerCheck.rowCount) return res.status(404).json({ error: "Provider not found" });

  const result = await pool.query(
    `SELECT id, action_type, details, performed_by_user_id, created_at
     FROM automation_action_logs WHERE ai_provider_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.params.id]
  );
  res.json({ logs: result.rows });
});
