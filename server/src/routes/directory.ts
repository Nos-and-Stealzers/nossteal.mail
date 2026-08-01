import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

export const directoryRouter = Router();
directoryRouter.use(requireAuth);

// Native mailboxes hosted on this instance — used as an address book / recipient
// picker when composing. Mail to these is delivered internally.
directoryRouter.get("/", async (_req, res) => {
  const result = await pool.query(
    `SELECT email_address AS address, display_name, is_ai_managed
     FROM email_accounts
     WHERE account_kind = 'native'
     ORDER BY is_ai_managed ASC, email_address ASC`
  );
  res.json({ entries: result.rows });
});
