import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "./env";
import { getDb } from "./db/index";
import {
  getMenuByCategory,
  getUpcomingEvents,
  getBandApplications,
  getTodaysSpecial,
  getBookedSeatNumbers,
  getUpcomingReservations,
  getOrdersForBoard,
  getOrderByPublicId,
  nowCentral,
  todayCentralISO,
} from "./db/queries";
import {
  bandApplications,
  bandApplicationStatus,
  events,
  menuCategories,
  menuCategorySections,
  menuItems,
  orderItems,
  orders,
  orderStatus,
  paymentMethods,
  reservations,
} from "./db/schema";
import { login, logout, isAuthenticated, requireAuth } from "./lib/auth";
import { notifyOwnerOfBandApplication } from "./lib/mailer";
import { checkRateLimit } from "./lib/rateLimit";
import { sendReservationSms } from "./lib/reservationNotify";
import { SEAT_LAYOUT, findSeat } from "./lib/seatLayout";
import { TAX_RATE, isOrderable, priceOrder } from "./lib/orders";

const app = new Hono<{ Bindings: Env }>();

app.use("*", secureHeaders());

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong." }, 500);
});

// ---------- Auth ----------

app.post("/api/auth/login", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  if (!(await checkRateLimit(c.env.LOGIN_RATE_LIMITER, ip))) {
    return c.json({ error: "Too many attempts. Try again in a minute." }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const ok = await login(c, email, password);
  if (!ok) return c.json({ error: "Invalid email or password." }, 401);
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
  section: z.enum(menuCategorySections).optional(),
});
const updateCategorySchema = newCategorySchema.partial().extend({
  section: z.enum(menuCategorySections).nullable().optional(),
});

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
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  if (!(await checkRateLimit(c.env.PUBLIC_FORM_RATE_LIMITER, `bands:${ip}`))) {
    return c.json({ error: "Too many submissions. Try again in a minute." }, 429);
  }

  const body = await c.req.json().catch(() => null);

  const humanVerified = await verifyTurnstile(
    c.env.TURNSTILE_SECRET,
    (body as { turnstileToken?: unknown } | null)?.turnstileToken,
    "bands",
    c.env.TURNSTILE_HOSTNAMES,
    ip
  );
  if (!humanVerified) {
    return c.json({ error: "Verification failed. Please try again." }, 403);
  }

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

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be an ISO-8601 date")
  .refine((date) => date >= todayCentralISO(), "date can't be in the past");

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "time must be HH:MM");

const reservationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/, "Enter a valid phone number"),
  date: dateSchema,
  partySize: z.coerce.number().int().min(1).max(20),
  time: timeSchema,
  seatNumber: z.coerce.number().int(),
});

function formatReservationDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function formatTime12h(hhmm: string) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

const availabilityQuerySchema = z.object({ date: dateSchema, time: timeSchema });

app.get("/api/reservations/availability", async (c) => {
  const parsed = availabilityQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const { date, time } = parsed.data;
  const bookedSeatNumbers = await getBookedSeatNumbers(getDb(c.env.DB), date, time);
  return c.json({ layout: SEAT_LAYOUT, bookedSeatNumbers });
});

app.post("/api/reserve", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  if (!(await checkRateLimit(c.env.PUBLIC_FORM_RATE_LIMITER, `reserve:${ip}`))) {
    return c.json({ error: "Too many reservation attempts. Try again in a minute." }, 429);
  }

  const body = await c.req.json().catch(() => null);

  const humanVerified = await verifyTurnstile(
    c.env.TURNSTILE_SECRET,
    (body as { turnstileToken?: unknown } | null)?.turnstileToken,
    "reserve",
    c.env.TURNSTILE_HOSTNAMES,
    ip
  );
  if (!humanVerified) {
    return c.json({ error: "Verification failed. Please try again." }, 403);
  }

  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const { name, phone, date, partySize, time, seatNumber } = parsed.data;

  const seat = findSeat(seatNumber);
  if (!seat) return c.json({ error: "That seat doesn't exist." }, 400);
  if (partySize > seat.capacity) {
    return c.json({ error: `That seat seats up to ${seat.capacity}.` }, 400);
  }

  const db = getDb(c.env.DB);
  const bookedSeatNumbers = await getBookedSeatNumbers(db, date, time);
  if (bookedSeatNumbers.includes(seatNumber)) {
    return c.json({ ok: false, error: "Sorry, that seat is booked for that time. Please pick another." });
  }

  await db.insert(reservations).values({ name, phone, partySize, seatNumber, date, time });

  const dateLabel = date === todayCentralISO() ? "today" : `on ${formatReservationDate(date)}`;
  const message = `Your table at Acme Restaurant is confirmed! Party of ${partySize} ${dateLabel} at ${formatTime12h(time)}. See you soon, ${name}!`;
  const sms = await sendReservationSms(c.env, phone, message);

  return c.json({ ok: true, sms });
});

const isoDateFormat = /^\d{4}-\d{2}-\d{2}$/;

app.get("/api/reservations", requireAuth, async (c) => {
  const date = c.req.query("date");
  if (date && !isoDateFormat.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }
  const list = await getUpcomingReservations(getDb(c.env.DB), date);
  return c.json(list);
});

app.delete("/api/reservations/:id", requireAuth, async (c) => {
  const reservationId = Number(c.req.param("id"));
  if (!Number.isInteger(reservationId)) return c.json({ error: "Invalid reservation id" }, 400);

  const [deleted] = await getDb(c.env.DB)
    .delete(reservations)
    .where(eq(reservations.id, reservationId))
    .returning();
  if (!deleted) return c.json({ error: "Reservation not found" }, 404);
  return c.json({ ok: true });
});

// ---------- Online orders ----------

// The public order page's menu: only what can actually be ordered for
// pickup right now (see isOrderable), grouped like the regular menu.
app.get("/api/orders/menu", async (c) => {
  const { dayOfWeek } = nowCentral();
  const menu = await getMenuByCategory(getDb(c.env.DB));
  const categories = menu
    .map((category) => ({ ...category, items: category.items.filter((item) => isOrderable(item, dayOfWeek)) }))
    .filter((category) => category.items.length > 0);
  return c.json({ categories, taxRate: TAX_RATE });
});

const newOrderSchema = z.object({
  customerName: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/, "Enter a valid phone number"),
  pickupTime: timeSchema.optional(),
  notes: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1, "Your order is empty.")
    .max(30),
});

app.post("/api/orders", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = newOrderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const { customerName, phone, pickupTime, notes, items } = parsed.data;
  const { dayOfWeek, hour } = nowCentral();
  if (pickupTime) {
    const [h, m] = pickupTime.split(":").map(Number);
    if (h + m / 60 < hour) return c.json({ error: "That pickup time has already passed." }, 400);
  }

  // Merge duplicate lines, then price everything from the database — the
  // client's idea of names/prices is never trusted.
  const quantities = new Map<number, number>();
  for (const line of items) {
    quantities.set(line.menuItemId, (quantities.get(line.menuItemId) ?? 0) + line.quantity);
  }

  const db = getDb(c.env.DB);
  const menuRows = await db
    .select()
    .from(menuItems)
    .where(inArray(menuItems.id, [...quantities.keys()]));

  const lines = [];
  for (const [menuItemId, quantity] of quantities) {
    const item = menuRows.find((row) => row.id === menuItemId);
    if (!item || !isOrderable(item, dayOfWeek)) {
      return c.json({ error: `${item?.name ?? "An item in your cart"} isn't available right now.` }, 409);
    }
    lines.push({ menuItemId, name: item.name, unitPrice: item.price, quantity });
  }

  const totals = priceOrder(lines);
  const [order] = await db
    .insert(orders)
    .values({ publicId: crypto.randomUUID(), customerName, phone, pickupTime, notes: notes || null, ...totals })
    .returning();

  try {
    await db.insert(orderItems).values(lines.map((line) => ({ ...line, orderId: order.id })));
  } catch (err) {
    await db.delete(orders).where(eq(orders.id, order.id));
    throw err;
  }

  return c.json({ id: order.id, publicId: order.publicId, total: order.total }, 201);
});

// Customer-facing status tracker, keyed by the unguessable publicId from
// checkout. Phone number is left out since this link is shareable.
app.get("/api/orders/track/:publicId", async (c) => {
  const order = await getOrderByPublicId(getDb(c.env.DB), c.req.param("publicId"));
  if (!order) return c.json({ error: "Order not found" }, 404);
  const { phone: _phone, ...publicOrder } = order;
  return c.json(publicOrder);
});

app.get("/api/orders", requireAuth, async (c) => {
  const board = await getOrdersForBoard(getDb(c.env.DB));
  return c.json(board);
});

const orderStatusUpdateSchema = z.object({ status: z.enum(orderStatus) });

app.patch("/api/orders/:id", requireAuth, async (c) => {
  const orderId = Number(c.req.param("id"));
  if (!Number.isInteger(orderId)) return c.json({ error: "Invalid order id" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = orderStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid order status" }, 400);

  const db = getDb(c.env.DB);
  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) return c.json({ error: "Order not found" }, 404);
  if (parsed.data.status === "Completed" && existing.paymentStatus !== "Paid") {
    return c.json({ error: "Collect payment before marking the order picked up." }, 409);
  }

  const [updated] = await db
    .update(orders)
    .set({ status: parsed.data.status })
    .where(eq(orders.id, orderId))
    .returning();
  return c.json(updated);
});

const paymentSchema = z.object({ method: z.enum(paymentMethods) });

// Staff record a cash or card payment taken at the counter.
app.post("/api/orders/:id/payment", requireAuth, async (c) => {
  const orderId = Number(c.req.param("id"));
  if (!Number.isInteger(orderId)) return c.json({ error: "Invalid order id" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "method must be Cash or Card" }, 400);

  const db = getDb(c.env.DB);
  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) return c.json({ error: "Order not found" }, 404);
  if (existing.status === "Cancelled") return c.json({ error: "That order was cancelled." }, 409);
  if (existing.paymentStatus === "Paid") return c.json({ error: "That order is already paid." }, 409);

  const [updated] = await db
    .update(orders)
    .set({ paymentStatus: "Paid", paymentMethod: parsed.data.method, paidAt: new Date().toISOString() })
    .where(eq(orders.id, orderId))
    .returning();
  return c.json(updated);
});

// ---------- Scheduled: cosmetic "servings remaining" auto-decrement ----------
//
// Purely a demo flourish, not real inventory tracking — online orders are
// food and non-alcoholic only, so no pours flow through them. Only ticks
// down tracked drinks (abv set, servingsRemaining not null) during a
// plausible open window in Central Time, and flips isAvailable off at
// zero. The admin CMS is how an owner "restocks" (resets
// servingsRemaining) after a keg change.
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
