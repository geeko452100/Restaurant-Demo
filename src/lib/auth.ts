import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../env";

const COOKIE_NAME = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toBase64Url(signature);
}

// PBKDF2-SHA256 with a high iteration count so a leaked ADMIN_PASSWORD_HASH
// can't be brute-forced the way a raw SHA-256 digest could. The salt is
// derived deterministically from AUTH_SECRET rather than stored separately
// — this means ADMIN_PASSWORD_HASH must be regenerated (via
// `npm run hash-password`) whenever AUTH_SECRET is rotated.
const PBKDF2_ITERATIONS = 600_000;

async function passwordSalt(authSecret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pbkdf2-salt:${authSecret}`));
  return new Uint8Array(digest);
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function createSessionToken(email: string, secret: string) {
  const payload = JSON.stringify({ u: email, exp: Date.now() + SESSION_TTL_SECONDS * 1000 });
  const encodedPayload = toBase64Url(new TextEncoder().encode(payload));
  const signature = await hmac(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expected = await hmac(secret, encodedPayload);
  if (expected !== signature) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function login(c: Context<{ Bindings: Env }>, email: string, password: string) {
  const salt = await passwordSalt(c.env.AUTH_SECRET);
  const candidate = await derivePasswordHash(password, salt);
  const expected = fromHex(c.env.ADMIN_PASSWORD_HASH);

  const emailMatches = email.trim().toLowerCase() === c.env.ADMIN_EMAIL.trim().toLowerCase();
  const passwordMatches = timingSafeEqual(candidate, expected);
  if (!emailMatches || !passwordMatches) return false;

  const token = await createSessionToken(email, c.env.AUTH_SECRET);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    // `wrangler dev` serves plain HTTP locally; a `Secure` cookie would be
    // silently dropped by the browser there. Real deployments are always
    // HTTPS, so this still enforces Secure everywhere it matters.
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export function logout(c: Context<{ Bindings: Env }>) {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export async function isAuthenticated(c: Context<{ Bindings: Env }>) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return false;
  return verifySessionToken(token, c.env.AUTH_SECRET);
}

// Middleware guarding /api/* routes that mutate or expose owner-only data.
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  if (!(await isAuthenticated(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}
