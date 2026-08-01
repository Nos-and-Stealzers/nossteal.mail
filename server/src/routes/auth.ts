import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  username: z
    .string()
    .min(3)
    .regex(/^[a-z0-9_-]+$/i, "Username can only contain letters, numbers, underscores, hyphens")
    .optional(),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, fullName, username } = parsed.data;

  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1 OR ($2::text IS NOT NULL AND username = $2)",
    [email, username ?? null]
  );
  if (existing.rowCount) {
    return res.status(409).json({ error: "Email or username already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, username) VALUES ($1, $2, $3, $4)
     RETURNING id, email, username, full_name, is_admin, created_at`,
    [email, passwordHash, fullName ?? null, username ?? null]
  );
  const user = result.rows[0];
  const token = signToken(user.id);
  res.status(201).json({ user, token });
});

const loginSchema = z.object({
  identifier: z.string().min(1), // email or username
  password: z.string(),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { identifier, password } = parsed.data;

  const result = await pool.query(
    "SELECT id, email, username, full_name, is_admin, password_hash FROM users WHERE email = $1 OR username = $1",
    [identifier]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken(user.id);
  delete user.password_hash;
  res.json({ user, token });
});

// ---- Authenticated account/settings endpoints ----

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const result = await pool.query(
    "SELECT id, email, username, full_name, is_admin, account_type, settings, created_at FROM users WHERE id = $1",
    [req.userId]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

const updateProfileSchema = z.object({
  fullName: z.string().max(255).nullish(),
  username: z
    .string()
    .min(3)
    .regex(/^[a-z0-9_-]+$/i, "Username can only contain letters, numbers, underscores, hyphens")
    .nullish(),
});

authRouter.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { fullName, username } = parsed.data;

  if (username) {
    const taken = await pool.query("SELECT id FROM users WHERE username = $1 AND id <> $2", [username, req.userId]);
    if (taken.rowCount) return res.status(409).json({ error: "Username already taken" });
  }

  const result = await pool.query(
    `UPDATE users SET
       full_name = COALESCE($1, full_name),
       username = COALESCE($2, username),
       updated_at = NOW()
     WHERE id = $3
     RETURNING id, email, username, full_name, is_admin, account_type, settings, created_at`,
    [fullName ?? null, username ?? null, req.userId]
  );
  res.json({ user: result.rows[0] });
});

const updateSettingsSchema = z.object({ settings: z.record(z.string(), z.unknown()) });

authRouter.put("/me/settings", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await pool.query(
    "UPDATE users SET settings = $1, updated_at = NOW() WHERE id = $2 RETURNING settings",
    [JSON.stringify(parsed.data.settings), req.userId]
  );
  res.json({ settings: result.rows[0].settings });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post("/change-password", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { currentPassword, newPassword } = parsed.data;

  const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.userId]);
  const row = result.rows[0];
  if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, req.userId]);
  res.json({ ok: true });
});

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}
