CREATE TABLE `reservations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`party_size` integer NOT NULL,
	`seat_number` integer NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reservations_date_seat_idx` ON `reservations` (`date`,`seat_number`);