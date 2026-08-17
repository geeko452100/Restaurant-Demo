import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { bandApplications, events, menuCategories, menuItems, reservations } from "./schema";
import { findSeat } from "../lib/seatLayout";

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

// ---------- Reservations ----------

// Each reservation occupies a fixed 2-hour block starting at its booked
// time; two bookings on the same seat/date conflict if their start times
// fall within 2 hours of each other in either direction.
const RESERVATION_WINDOW_MINUTES = 120;

function timeToMinutes(hhmm: string) {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
}

export async function getReservationsForDate(db: Db, date: string) {
  return db.select().from(reservations).where(eq(reservations.date, date));
}

// Seat numbers that conflict with the given date/time across the whole
// floor plan in one query — used by both the availability endpoint (to
// gray out the grid) and the reserve endpoint (to reject a booking).
export async function getBookedSeatNumbers(db: Db, date: string, time: string) {
  const requestedMinutes = timeToMinutes(time);
  const dayReservations = await getReservationsForDate(db, date);
  const booked = new Set<number>();
  for (const r of dayReservations) {
    if (Math.abs(timeToMinutes(r.time) - requestedMinutes) < RESERVATION_WINDOW_MINUTES) {
      booked.add(r.seatNumber);
    }
  }
  return [...booked];
}

export async function getUpcomingReservations(db: Db, date?: string) {
  const rows = date
    ? await db.select().from(reservations).where(eq(reservations.date, date)).orderBy(asc(reservations.time))
    : await db
        .select()
        .from(reservations)
        .where(sql`${reservations.date} >= date('now')`)
        .orderBy(asc(reservations.date), asc(reservations.time));

  return rows.map((r) => {
    const seat = findSeat(r.seatNumber);
    return { ...r, seatType: seat?.type ?? null, seatCapacity: seat?.capacity ?? null };
  });
}
