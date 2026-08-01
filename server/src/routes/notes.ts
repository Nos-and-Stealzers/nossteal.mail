import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const notesRouter = Router();
notesRouter.use(requireAuth);

notesRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    "SELECT id, title, content, tags, created_at, updated_at FROM notes WHERE user_id = $1 ORDER BY updated_at DESC",
    [req.userId]
  );
  res.json({ notes: result.rows });
});

const noteSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

notesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const n = parsed.data;

  const result = await pool.query(
    `INSERT INTO notes (user_id, title, content, tags) VALUES ($1,$2,$3,$4)
     RETURNING id, title, content, tags, created_at, updated_at`,
    [req.userId, n.title ?? null, n.content ?? null, n.tags ?? []]
  );
  res.status(201).json({ note: result.rows[0] });
});

notesRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const n = parsed.data;

  const result = await pool.query(
    `UPDATE notes SET
       title = COALESCE($1, title),
       content = COALESCE($2, content),
       tags = COALESCE($3, tags),
       updated_at = NOW()
     WHERE id = $4 AND user_id = $5
     RETURNING id, title, content, tags, created_at, updated_at`,
    [n.title ?? null, n.content ?? null, n.tags ?? null, req.params.id, req.userId]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Note not found" });
  res.json({ note: result.rows[0] });
});

notesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query("DELETE FROM notes WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.status(204).send();
});
