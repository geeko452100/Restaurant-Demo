import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../env";

const COOKIE_NAME = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Best-effort brute-force throttle: 5 attempts/minute per IP, held in
// module-scope memory. This resets whenever the isolate is recycled and
// isn't shared across Cloudflare's edge locations, so it's a speed bump
// rather than a real guarantee — for a hard guarantee, move this to a
// Durable Object or Cloudflare's Rate Limiting binding.
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_WINDOW_MS = 60_000;
const loginAttempts = new Map<string, { count: number; windowStart: number }>();

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= LOGIN_ATTEMPT_LIMIT) return false;
  entry.count += 1;
  return true;
}

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

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createSessionToken(username: string, secret: string) {
  const payload = JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL_SECONDS * 1000 });
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

export async function login(c: Context<{ Bindings: Env }>, username: string, password: string) {
  const hashed = await sha256Hex(password);
  const valid = username === c.env.ADMIN_USERNAME && hashed === c.env.ADMIN_PASSWORD_HASH;
  if (!valid) return false;

  const token = await createSessionToken(username, c.env.AUTH_SECRET);
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
