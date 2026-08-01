import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/stats", async (_req: AuthedRequest, res) => {
  const [users, messages, aiProviders, workflows, domains] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM users"),
    pool.query("SELECT COUNT(*)::int AS count FROM messages"),
    pool.query("SELECT COUNT(*)::int AS count FROM ai_providers"),
    pool.query("SELECT COUNT(*)::int AS count FROM workflows"),
    pool.query("SELECT COUNT(*)::int AS count FROM domains"),
  ]);

  res.json({
    stats: {
      users: users.rows[0].count,
      messages: messages.rows[0].count,
      aiProviders: aiProviders.rows[0].count,
      workflows: workflows.rows[0].count,
      domains: domains.rows[0].count,
    },
  });
});

adminRouter.get("/users", async (_req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, email, username, full_name, account_type, subscription_status, is_admin, created_at
     FROM users ORDER BY created_at ASC`
  );
  res.json({ users: result.rows });
});

adminRouter.patch("/users/:id/admin", async (req: AuthedRequest, res) => {
  const isAdmin = req.body?.isAdmin;
  if (typeof isAdmin !== "boolean") {
    return res.status(400).json({ error: "isAdmin must be a boolean" });
  }
  if (req.params.id === req.userId && !isAdmin) {
    return res.status(400).json({ error: "You can't remove your own admin access" });
  }

  const result = await pool.query(
    "UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, username, is_admin",
    [isAdmin, req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "User not found" });
  res.json({ user: result.rows[0] });
});
