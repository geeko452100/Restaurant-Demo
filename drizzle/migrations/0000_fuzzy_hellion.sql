CREATE TABLE `band_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`band_name` text NOT NULL,
	`genre` text NOT NULL,
	`rate` real,
	`email` text NOT NULL,
	`media_link` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`event_date` text NOT NULL,
	`start_time` text,
	`cover_charge` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`abv` real,
	`is_available` integer DEFAULT true NOT NULL,
	`is_local` integer DEFAULT false NOT NULL,
	`is_gluten_free` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
