import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { bandApplications, events, menuCategories, menuItems } from "./schema";

// The restaurant operates on Central Time regardless of where the edge
// node or a visitor's browser happens to be, so "today" and "now" for
// scheduling purposes are always computed against America/Chicago.
const CENTRAL_TIME_ZONE = "America/Chicago";

const centralDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CENTRAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const centralPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL_TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function todayCentralISO() {
  return centralDateFormatter.format(new Date()); // en-CA => YYYY-MM-DD
}

// Central-Time day-of-week (0=Sun..6=Sat) and fractional hour-of-day,
// independent of the Worker's own execution timezone (always UTC).
export function nowCentral() {
  const parts = centralPartsFormatter.formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { dayOfWeek: WEEKDAY_INDEX[weekday] ?? 0, hour: hour + minute / 60 };
}

// `includeInactive` is for the authenticated admin CMS, which needs to
// see (and reactivate) seasonally-hidden items; the public menu never
// gets them.
export async function getMenuByCategory(db: Db, { includeInactive = false } = {}) {
  const categories = await db
    .select()
    .from(menuCategories)
    .orderBy(asc(menuCategories.displayOrder));
  const items = includeInactive
    ? await db.select().from(menuItems).orderBy(asc(menuItems.displayOrder))
    : await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.isActive, true))
        .orderBy(asc(menuItems.displayOrder));

  return categories.map((category) => ({
    ...category,
    items: items.filter((item) => item.categoryId === category.id),
  }));
}

// Auto-expiring select: only events today or later ever leave the edge.
// Uses SQLite's own runtime date('now') rather than a JS-computed value
// so the filter stays correct at the database layer regardless of caller.
export async function getUpcomingEvents(db: Db) {
  return db
    .select()
    .from(events)
    .where(sql`${events.eventDate} >= date('now')`)
    .orderBy(asc(events.eventDate));
}

export async function getTonightsEvent(db: Db) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.eventDate, todayCentralISO()))
    .limit(1);
  return event ?? null;
}

const LUNCH_START_HOUR = 11;
const LUNCH_END_HOUR = 14; // 2pm

// Today's lunch special computed server-side in Central Time, so the
// answer is correct no matter what timezone a visitor's browser reports.
export async function getTodaysSpecial(db: Db) {
  const { dayOfWeek, hour } = nowCentral();
  const isLunchWindow = hour >= LUNCH_START_HOUR && hour < LUNCH_END_HOUR;

  const [special] = await db
    .select()
    .from(menuItems)
    .where(
      and(eq(menuItems.dayOfWeek, dayOfWeek), eq(menuItems.isAvailable, true), eq(menuItems.isActive, true))
    )
    .limit(1);

  return { special: special ?? null, isLunchWindow, today: todayCentralISO() };
}

export async function getBandApplications(db: Db) {
  return db.select().from(bandApplications).orderBy(desc(bandApplications.submittedAt));
}
