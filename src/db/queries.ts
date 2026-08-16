import { asc, desc, eq, gte } from "drizzle-orm";
import type { Db } from "./index";
import { bandApplications, events, menuCategories, menuItems } from "./schema";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function getMenuByCategory(db: Db) {
  const categories = await db
    .select()
    .from(menuCategories)
    .orderBy(asc(menuCategories.displayOrder));
  const items = await db.select().from(menuItems).orderBy(asc(menuItems.displayOrder));

  return categories.map((category) => ({
    ...category,
    items: items.filter((item) => item.categoryId === category.id),
  }));
}

// Auto-expiring select: only events today or later ever leave the edge.
export async function getUpcomingEvents(db: Db) {
  return db
    .select()
    .from(events)
    .where(gte(events.eventDate, todayISO()))
    .orderBy(asc(events.eventDate));
}

export async function getTonightsEvent(db: Db) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.eventDate, todayISO()))
    .limit(1);
  return event ?? null;
}

export async function getBandApplications(db: Db) {
  return db.select().from(bandApplications).orderBy(desc(bandApplications.submittedAt));
}
