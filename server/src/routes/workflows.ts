import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { executeWorkflow, workflowDefinitionSchema } from "../services/workflowEngine.js";

export const workflowsRouter = Router();
workflowsRouter.use(requireAuth);

workflowsRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, name, description, is_enabled, trigger_type, workflow_definition,
            execution_count, success_count, failure_count, last_execution_at, created_at
     FROM workflows WHERE user_id = $1 ORDER BY created_at ASC`,
    [req.userId]
  );
  res.json({ workflows: result.rows });
});

const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: workflowDefinitionSchema,
});

workflowsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createWorkflowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const w = parsed.data;

  const result = await pool.query(
    `INSERT INTO workflows (user_id, name, description, trigger_type, workflow_definition)
     VALUES ($1,$2,$3,'manual',$4)
     RETURNING id, name, description, is_enabled, trigger_type, workflow_definition, created_at`,
    [req.userId, w.name, w.description ?? null, JSON.stringify(w.steps)]
  );
  res.status(201).json({ workflow: result.rows[0] });
});

workflowsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query("DELETE FROM workflows WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.status(204).send();
});

workflowsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const schema = z.object({ isEnabled: z.boolean().optional(), steps: workflowDefinitionSchema.optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await pool.query(
    `UPDATE workflows SET
       is_enabled = COALESCE($1, is_enabled),
       workflow_definition = COALESCE($2, workflow_definition),
       updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, name, is_enabled, workflow_definition`,
    [
      parsed.data.isEnabled ?? null,
      parsed.data.steps ? JSON.stringify(parsed.data.steps) : null,
      req.params.id,
      req.userId,
    ]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Workflow not found" });
  res.json({ workflow: result.rows[0] });
});

// Manual trigger only — schedule/email_received triggers are stored but inert until
// a background job runner exists to fire them.
workflowsRouter.post("/:id/run", async (req: AuthedRequest, res) => {
  const workflowResult = await pool.query("SELECT * FROM workflows WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  const workflow = workflowResult.rows[0];
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });
  if (!workflow.is_enabled) return res.status(400).json({ error: "Workflow is disabled" });

  const steps = workflowDefinitionSchema.parse(workflow.workflow_definition);
  const stepResults = await executeWorkflow(req.userId!, steps);
  const hasError = stepResults.some((r) => r.status === "error");
  const allError = stepResults.every((r) => r.status === "error");
  const status = allError ? "failed" : hasError ? "partial" : "success";

  const executionResult = await pool.query(
    `INSERT INTO workflow_executions (workflow_id, status, step_results, finished_at)
     VALUES ($1,$2,$3,NOW()) RETURNING id, status, step_results, started_at, finished_at`,
    [workflow.id, status, JSON.stringify(stepResults)]
  );

  await pool.query(
    `UPDATE workflows SET
       execution_count = execution_count + 1,
       success_count = success_count + CASE WHEN $1 = 'success' THEN 1 ELSE 0 END,
       failure_count = failure_count + CASE WHEN $1 = 'failed' THEN 1 ELSE 0 END,
       last_execution_at = NOW()
     WHERE id = $2`,
    [status, workflow.id]
  );

  res.status(201).json({ execution: executionResult.rows[0] });
});

workflowsRouter.get("/:id/executions", async (req: AuthedRequest, res) => {
  const ownerCheck = await pool.query("SELECT id FROM workflows WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  if (!ownerCheck.rowCount) return res.status(404).json({ error: "Workflow not found" });

  const result = await pool.query(
    `SELECT id, status, step_results, error_message, started_at, finished_at
     FROM workflow_executions WHERE workflow_id = $1 ORDER BY started_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json({ executions: result.rows });
});
