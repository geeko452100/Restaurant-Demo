PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_band_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`band_name` text NOT NULL,
	`genre` text NOT NULL,
	`rate` real,
	`email` text NOT NULL,
	`media_link` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`submitted_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_band_applications`("id", "band_name", "genre", "rate", "email", "media_link", "status", "submitted_at") SELECT "id", "band_name", "genre", "rate", "email", "media_link",
	CASE "status"
		WHEN 'pending' THEN 'Pending'
		WHEN 'approved' THEN 'Reviewed'
		WHEN 'archived' THEN 'Booked'
		ELSE "status"
	END,
	"submitted_at" FROM `band_applications`;--> statement-breakpoint
DROP TABLE `band_applications`;--> statement-breakpoint
ALTER TABLE `__new_band_applications` RENAME TO `band_applications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `servings_remaining` integer;--> statement-breakpoint
CREATE INDEX `events_event_date_idx` ON `events` (`event_date`);