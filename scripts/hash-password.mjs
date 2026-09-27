// Computes PBKDF2 password hashes matching src/lib/auth.ts exactly.
//
// Owner login (ADMIN_PASSWORD_HASH): salt is derived from AUTH_SECRET, so
// the hash must be regenerated whenever AUTH_SECRET changes.
//   node scripts/hash-password.mjs <auth-secret> <password>
//
// Staff login (staff_users table): random per-user salt, independent of
// AUTH_SECRET. Prints an INSERT statement to run with `wrangler d1 execute`
// or paste into src/db/seed.sql.
//   node scripts/hash-password.mjs --staff <email> <password>

import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";

const ITERATIONS = 100_000; // must match PBKDF2_ITERATIONS in src/lib/auth.ts

const args = process.argv.slice(2);

if (args[0] === "--staff") {
  const [, email, password] = args;
  if (!email || !password) {
    console.error("Usage: node scripts/hash-password.mjs --staff <email> <password>");
    process.exit(1);
  }
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const safeEmail = email.trim().toLowerCase().replace(/'/g, "''");
  console.log(
    `INSERT OR IGNORE INTO staff_users (email, password_hash, password_salt) VALUES ('${safeEmail}', '${hash.toString("hex")}', '${salt.toString("hex")}');`
  );
  process.exit(0);
}

const [authSecret, password] = args;
if (!authSecret || !password) {
  console.error("Usage: node scripts/hash-password.mjs <auth-secret> <password>");
  console.error("       node scripts/hash-password.mjs --staff <email> <password>");
  process.exit(1);
}

const salt = createHash("sha256").update(`pbkdf2-salt:${authSecret}`).digest();
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");

console.log(hash.toString("hex"));
