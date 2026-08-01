import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

// Rotate the primary admin account in place so all owned data (domains,
// mailboxes, AI providers) stays attached. Usage:
//   node src/db/setAdmin.mjs <username> <password> [email]
const [, , username, password, emailArg] = process.argv;

async function main() {
  if (!username || !password) {
    console.error("Usage: node src/db/setAdmin.mjs <username> <password> [email]");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);

  // Prefer the existing admin (oldest admin row) so we keep its owned data.
  const admin = await pool.query(
    "SELECT id FROM users WHERE is_admin = TRUE ORDER BY created_at ASC LIMIT 1"
  );

  if (admin.rowCount) {
    const id = admin.rows[0].id;
    const email = emailArg ?? null;
    await pool.query(
      `UPDATE users SET username = $1, password_hash = $2, is_admin = TRUE,
         email = COALESCE($3, email), updated_at = NOW() WHERE id = $4`,
      [username, passwordHash, email, id]
    );
    console.log(`Updated admin account -> username '${username}' (id ${id}).`);
  } else {
    const email = emailArg ?? `${username}@admin.local`;
    await pool.query(
      "INSERT INTO users (email, username, password_hash, is_admin) VALUES ($1,$2,$3,TRUE)",
      [email, username, passwordHash]
    );
    console.log(`Created admin account -> username '${username}'.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
