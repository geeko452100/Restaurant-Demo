// Computes the PBKDF2 hash for ADMIN_PASSWORD_HASH, matching the algorithm
// in src/lib/auth.ts exactly (salt is derived from AUTH_SECRET, so the
// hash must be regenerated whenever AUTH_SECRET changes).
//
// Usage: node scripts/hash-password.mjs <auth-secret> <password>

import { createHash, pbkdf2Sync } from "node:crypto";

const ITERATIONS = 600_000;

const [authSecret, password] = process.argv.slice(2);
if (!authSecret || !password) {
  console.error("Usage: node scripts/hash-password.mjs <auth-secret> <password>");
  process.exit(1);
}

const salt = createHash("sha256").update(`pbkdf2-salt:${authSecret}`).digest();
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");

console.log(hash.toString("hex"));
