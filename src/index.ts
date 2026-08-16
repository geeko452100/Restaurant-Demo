import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "./env";
import { getDb } from "./db/index";
import {
  getMenuByCategory,
  getUpcomingEvents,
  getBandApplications,
  getTodaysSpecial,
  nowCentral,
} from "./db/queries";
import { bandApplications, bandApplicationStatus, events, menuCategories, menuItems } from "./db/schema";
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

// Admin CMS view: includes seasonally-inactive items so they can be
// reviewed and reactivated.
app.get("/api/menu/all", requireAuth, async (c) => {
  const menu = await getMenuByCategory(getDb(c.env.DB), { includeInactive: true });
  return c.json(menu);
});

const newCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  displayOrder: z.number().int().min(0).max(999).default(0),
  imageUrl: z.string().trim().url().optional(),
});
const updateCategorySchema = newCategorySchema.partial();

app.post("/api/menu/categories", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = newCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [category] = await getDb(c.env.DB).insert(menuCategories).values(parsed.data).returning();
  return c.json(category, 201);
});

app.patch("/api/menu/categories/:id", requireAuth, async (c) => {
  const categoryId = Number(c.req.param("id"));
  if (!Number.isInteger(categoryId)) return c.json({ error: "Invalid category id" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [updated] = await getDb(c.env.DB)
    .update(menuCategories)
    .set(parsed.data)
    .where(eq(menuCategories.id, categoryId))
    .returning();

  if (!updated) return c.json({ error: "Category not found" }, 404);
  return c.json(updated);
});

// Deleting a category cascades to its menu items (see schema's
// onDelete: "cascade" on menu_items.category_id) — the admin UI confirms
// with the owner before calling this, since it's not reversible.
app.delete("/api/menu/categories/:id", requireAuth, async (c) => {
  const categoryId = Number(c.req.param("id"));
  if (!Number.isInteger(categoryId)) return c.json({ error: "Invalid category id" }, 400);

  const [deleted] = await getDb(c.env.DB)
    .delete(menuCategories)
    .where(eq(menuCategories.id, categoryId))
    .returning();

  if (!deleted) return c.json({ error: "Category not found" }, 404);
  return c.json({ ok: true });
});

const newMenuItemSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  price: z.number().min(0).max(1000),
  abv: z.number().min(0).max(100).optional(),
  imageUrl: z.string().trim().url().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  isAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isLocal: z.boolean().default(false),
  isGlutenFree: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(999).default(0),
  servingsRemaining: z.number().int().min(0).max(100000).optional(),
});
const updateMenuItemSchema = newMenuItemSchema.partial();

app.post("/api/menu", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = newMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [item] = await getDb(c.env.DB).insert(menuItems).values(parsed.data).returning();
  return c.json(item, 201);
});

// Handles both the quick availability-toggle switch (empty body) and a
// full field edit from the admin CMS (body with one or more fields).
app.patch("/api/menu/:id", requireAuth, async (c) => {
  const itemId = Number(c.req.param("id"));
  if (!Number.isInteger(itemId)) return c.json({ error: "Invalid item id" }, 400);

  const db = getDb(c.env.DB);
  const [existing] = await db.select().from(menuItems).where(eq(menuItems.id, itemId)).limit(1);
  if (!existing) return c.json({ error: "Menu item not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const hasFields = body && typeof body === "object" && Object.keys(body).length > 0;

  let patch: Record<string, unknown>;
  if (hasFields) {
    const parsed = updateMenuItemSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
    }
    patch = parsed.data;
  } else {
    patch = { isAvailable: !existing.isAvailable };
  }

  const [updated] = await db.update(menuItems).set(patch).where(eq(menuItems.id, itemId)).returning();
  return c.json(updated);
});

app.delete("/api/menu/:id", requireAuth, async (c) => {
  const itemId = Number(c.req.param("id"));
  if (!Number.isInteger(itemId)) return c.json({ error: "Invalid item id" }, 400);

  const [deleted] = await getDb(c.env.DB).delete(menuItems).where(eq(menuItems.id, itemId)).returning();
  if (!deleted) return c.json({ error: "Menu item not found" }, 404);
  return c.json({ ok: true });
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

const updateEventSchema = newEventSchema.partial();

app.patch("/api/events/:id", requireAuth, async (c) => {
  const eventId = Number(c.req.param("id"));
  if (!Number.isInteger(eventId)) return c.json({ error: "Invalid event id" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [updated] = await getDb(c.env.DB)
    .update(events)
    .set(parsed.data)
    .where(eq(events.id, eventId))
    .returning();

  if (!updated) return c.json({ error: "Event not found" }, 404);
  return c.json(updated);
});

app.delete("/api/events/:id", requireAuth, async (c) => {
  const eventId = Number(c.req.param("id"));
  if (!Number.isInteger(eventId)) return c.json({ error: "Invalid event id" }, 400);

  const [deleted] = await getDb(c.env.DB).delete(events).where(eq(events.id, eventId)).returning();
  if (!deleted) return c.json({ error: "Event not found" }, 404);
  return c.json({ ok: true });
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

// ---------- Scheduled: cosmetic "servings remaining" auto-decrement ----------
//
// Purely a demo flourish, not real inventory tracking — there's no order
// system behind it. Only ticks down tracked drinks (abv set,
// servingsRemaining not null) during a plausible open window in Central
// Time, and flips isAvailable off at zero. The admin CMS is how an owner
// "restocks" (resets servingsRemaining) after a keg change.
const OPEN_HOUR = 11;
const CLOSE_HOUR = 23;

async function decrementServings(env: Env) {
  const { hour } = nowCentral();
  if (hour < OPEN_HOUR || hour >= CLOSE_HOUR) return;

  const db = getDb(env.DB);
  const drinks = await db
    .select()
    .from(menuItems)
    .where(
      and(isNotNull(menuItems.abv), isNotNull(menuItems.servingsRemaining), eq(menuItems.isAvailable, true))
    );

  for (const drink of drinks) {
    if (drink.servingsRemaining == null || drink.servingsRemaining <= 0) continue;
    const pour = 1 + Math.floor(Math.random() * 4); // 1-4 servings per tick
    const remaining = Math.max(0, drink.servingsRemaining - pour);
    await db
      .update(menuItems)
      .set({ servingsRemaining: remaining, isAvailable: remaining > 0 })
      .where(eq(menuItems.id, drink.id));
  }
}

export default {
  fetch: app.fetch,
  scheduled: async (_controller, env) => {
    await decrementServings(env);
  },
} satisfies ExportedHandler<Env>;
