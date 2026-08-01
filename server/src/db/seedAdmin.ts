import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

const username = process.env.SEED_ADMIN_USERNAME;
const password = process.env.SEED_ADMIN_PASSWORD;
const email = process.env.SEED_ADMIN_EMAIL ?? `${username}@admin.local`;

async function seedAdmin() {
  if (!username || !password) {
    console.error("Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD env vars before running this script.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
  if (existing.rowCount) {
    await pool.query(
      "UPDATE users SET password_hash = $1, is_admin = TRUE, updated_at = NOW() WHERE username = $2",
      [passwordHash, username]
    );
    console.log(`Updated existing user '${username}' and granted admin.`);
  } else {
    await pool.query(
      `INSERT INTO users (email, username, password_hash, is_admin) VALUES ($1,$2,$3,TRUE)`,
      [email, username, passwordHash]
    );
    console.log(`Created admin user '${username}'.`);
  }

  await pool.end();
}

seedAdmin().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
