import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db/pool.js";

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

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}
