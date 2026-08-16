import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "./env";
import { getDb } from "./db/index";
import { getMenuByCategory, getUpcomingEvents, getBandApplications, getTodaysSpecial } from "./db/queries";
import { bandApplications, bandApplicationStatus, events, menuItems } from "./db/schema";
import { login, logout, isAuthenticated, requireAuth, checkLoginRateLimit } from "./lib/auth";
import { sendReservationSms } from "./lib/reservationNotify";
import { notifyOwnerOfBandApplication } from "./lib/mailer";

const app = new Hono<{ Bindings: Env }>();

app.use("*", secureHeaders());

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong." }, 500);
});

// ---------- Auth ----------

app.post("/api/auth/login", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  if (!checkLoginRateLimit(ip)) {
    return c.json({ error: "Too many attempts. Try again in a minute." }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const ok = await login(c, username, password);
  if (!ok) return c.json({ error: "Invalid username or password." }, 401);
  return c.json({ ok: true });
});

app.post("/api/auth/logout", (c) => {
  logout(c);
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  return c.json({ authenticated: await isAuthenticated(c) });
});

// ---------- Menu ----------

app.get("/api/menu", async (c) => {
  const menu = await getMenuByCategory(getDb(c.env.DB));
  return c.json(menu);
});

// Server-computed "today's lunch special" in Central Time.
app.get("/api/specials", async (c) => {
  const result = await getTodaysSpecial(getDb(c.env.DB));
  return c.json(result);
});

// Secure inventory toggle: only an authenticated owner session may flip
// `is_available`.
app.patch("/api/menu/:id", requireAuth, async (c) => {
  const itemId = Number(c.req.param("id"));
  if (!Number.isInteger(itemId)) return c.json({ error: "Invalid item id" }, 400);

  const db = getDb(c.env.DB);
  const [existing] = await db.select().from(menuItems).where(eq(menuItems.id, itemId)).limit(1);
  if (!existing) return c.json({ error: "Menu item not found" }, 404);

  const [updated] = await db
    .update(menuItems)
    .set({ isAvailable: !existing.isAvailable })
    .where(eq(menuItems.id, itemId))
    .returning();

  return c.json(updated);
});

// ---------- Events ----------

app.get("/api/events", async (c) => {
  const upcoming = await getUpcomingEvents(getDb(c.env.DB));
  return c.json(upcoming);
});

const newEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "eventDate must be an ISO-8601 date"),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM")
    .optional(),
  coverCharge: z.number().min(0).max(500).default(0),
});

app.post("/api/events", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = newEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [event] = await getDb(c.env.DB).insert(events).values(parsed.data).returning();
  return c.json(event, 201);
});

// ---------- Band applications ----------

const mediaLinkSchema = z
  .string()
  .trim()
  .url()
  .refine((url) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return (
        host === "open.spotify.com" ||
        host.endsWith(".spotify.com") ||
        host === "youtube.com" ||
        host === "youtu.be"
      );
    } catch {
      return false;
    }
  }, "media link must be a Spotify or YouTube URL");

const newApplicationSchema = z.object({
  bandName: z.string().trim().min(1).max(120),
  genre: z.string().trim().min(1).max(60),
  rate: z.coerce.number().min(0).max(100000).optional(),
  email: z.string().trim().email(),
  mediaLink: mediaLinkSchema,
});

app.get("/api/bands", requireAuth, async (c) => {
  const applications = await getBandApplications(getDb(c.env.DB));
  return c.json(applications);
});

app.post("/api/bands", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = newApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [application] = await getDb(c.env.DB)
    .insert(bandApplications)
    .values(parsed.data)
    .returning();

  notifyOwnerOfBandApplication(c.env, c.executionCtx, parsed.data);
  return c.json(application, 201);
});

const statusSchema = z.object({ status: z.enum(bandApplicationStatus) });

app.patch("/api/bands/:id", requireAuth, async (c) => {
  const applicationId = Number(c.req.param("id"));
  if (!Number.isInteger(applicationId)) return c.json({ error: "Invalid application id" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "status must be Pending, Reviewed, or Booked" }, 400);
  }

  const [updated] = await getDb(c.env.DB)
    .update(bandApplications)
    .set({ status: parsed.data.status })
    .where(eq(bandApplications.id, applicationId))
    .returning();

  if (!updated) return c.json({ error: "Application not found" }, 404);
  return c.json(updated);
});

// ---------- Reservations ----------

const reservationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/, "Enter a valid phone number"),
  partySize: z.coerce.number().int().min(1).max(20),
  time: z.string().regex(/^\d{2}:\d{2}$/, "time must be HH:MM"),
});

app.post("/api/reserve", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const { name, phone, partySize, time } = parsed.data;
  const message = `Your table at Rhythm & Brews is confirmed! Party of ${partySize} at ${time}. See you soon, ${name}!`;
  const result = await sendReservationSms(c.env, phone, message);

  if (!result.sent && !result.stub) {
    return c.json({ sent: false, error: result.error }, 502);
  }

  return c.json(result);
});

export default app;
