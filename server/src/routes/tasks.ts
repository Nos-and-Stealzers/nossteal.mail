import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    "SELECT id, title, description, is_done, due_date, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY is_done ASC, due_date ASC NULLS LAST, created_at DESC",
    [req.userId]
  );
  res.json({ tasks: result.rows });
});

const taskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  isDone: z.boolean().optional(),
  dueDate: z.string().datetime().optional(),
});

tasksRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.title) {
    return res.status(400).json({ error: parsed.success ? "title is required" : parsed.error.flatten() });
  }
  const t = parsed.data;

  const result = await pool.query(
    `INSERT INTO tasks (user_id, title, description, due_date) VALUES ($1,$2,$3,$4)
     RETURNING id, title, description, is_done, due_date, created_at, updated_at`,
    [req.userId, t.title, t.description ?? null, t.dueDate ?? null]
  );
  res.status(201).json({ task: result.rows[0] });
});

tasksRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const t = parsed.data;

  const result = await pool.query(
    `UPDATE tasks SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       is_done = COALESCE($3, is_done),
       due_date = COALESCE($4, due_date),
       updated_at = NOW()
     WHERE id = $5 AND user_id = $6
     RETURNING id, title, description, is_done, due_date, created_at, updated_at`,
    [t.title ?? null, t.description ?? null, t.isDone ?? null, t.dueDate ?? null, req.params.id, req.userId]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Task not found" });
  res.json({ task: result.rows[0] });
});

tasksRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query("DELETE FROM tasks WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.status(204).send();
});
