import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const result = await pool.query("SELECT is_admin FROM users WHERE id = $1", [req.userId]);
  if (!result.rows[0]?.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
