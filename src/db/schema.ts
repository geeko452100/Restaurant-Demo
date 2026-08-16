import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, real, index } from "drizzle-orm/sqlite-core";

// SQLite (D1) has no native boolean or datetime type: booleans are stored as
// INTEGER 0/1 and every date/time value is normalized to an ISO-8601 TEXT
// string so comparisons stay consistent across edge nodes.

export const menuCategories = sqliteTable("menu_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  imageUrl: text("image_url"),
});

export const menuItems = sqliteTable("menu_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => menuCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  abv: real("abv"),
  // Absolute URL to a real product photo. Left null until the owner has
  // one; the frontend falls back to a themed icon placeholder.
  imageUrl: text("image_url"),
  // 0=Sunday..6=Saturday. Set only on day-specific lunch specials; null
  // for the regular tap list / always-available items.
  dayOfWeek: integer("day_of_week"),
  isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  // Seasonal on/off switch (e.g. hide a lunch special out of season)
  // distinct from `isAvailable`, which is the 86'd/sold-out toggle.
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isLocal: integer("is_local", { mode: "boolean" }).notNull().default(false),
  isGlutenFree: integer("is_gluten_free", { mode: "boolean" }).notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  // Cosmetic "servings remaining" counter for beverages (abv != null).
  // Null means untracked; a scheduled Worker cron decrements it and
  // flips isAvailable off at zero. Admin can restock via the CMS.
  servingsRemaining: integer("servings_remaining"),
});

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: text("event_date").notNull(), // ISO-8601 date, e.g. "2026-09-05"
    startTime: text("start_time"), // ISO-8601 time, e.g. "20:00"
    coverCharge: real("cover_charge").notNull().default(0),
    imageUrl: text("image_url"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    eventDateIdx: index("events_event_date_idx").on(table.eventDate),
  })
);

export const bandApplicationStatus = ["Pending", "Reviewed", "Booked"] as const;
export type BandApplicationStatus = (typeof bandApplicationStatus)[number];

export const bandApplications = sqliteTable("band_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bandName: text("band_name").notNull(),
  genre: text("genre").notNull(),
  rate: real("rate"),
  email: text("email").notNull(),
  mediaLink: text("media_link").notNull(),
  status: text("status", { enum: bandApplicationStatus }).notNull().default("Pending"),
  submittedAt: text("submitted_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type MenuCategory = typeof menuCategories.$inferSelect;
export type NewMenuCategory = typeof menuCategories.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type BandApplication = typeof bandApplications.$inferSelect;
export type NewBandApplication = typeof bandApplications.$inferInsert;
