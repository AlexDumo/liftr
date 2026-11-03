CREATE TABLE `day_favorites` (
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`day_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `exercise_id`, `day_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `workout_days`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `day_favorites_user_day_idx` ON `day_favorites` (`user_id`,`day_id`);--> statement-breakpoint
CREATE TABLE `workout_days` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_cardio` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `workout_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_days_profileId_idx` ON `workout_days` (`profile_id`);--> statement-breakpoint
CREATE TABLE `workout_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_profiles_userId_idx` ON `workout_profiles` (`user_id`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `active_profile_id` text REFERENCES workout_profiles(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `workouts` ADD `day_id` text REFERENCES workout_days(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `workouts` ADD `day_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Backfill: every existing user gets the old fixed split as their first profile.
INSERT INTO `workout_profiles` (`id`, `user_id`, `name`)
SELECT 'legacy-' || `id`, `id`, 'Push / Pull / Legs' FROM `users`;--> statement-breakpoint
INSERT INTO `workout_days` (`id`, `profile_id`, `name`, `description`, `is_cardio`, `sort_order`)
SELECT 'legacy-' || u.`id` || '-' || d.`day_type`, 'legacy-' || u.`id`, d.`name`, d.`description`, d.`is_cardio`, d.`sort_order`
FROM `users` u
CROSS JOIN (
	SELECT 'push' AS `day_type`, 'Push' AS `name`, 'Chest, shoulders, triceps' AS `description`, 0 AS `is_cardio`, 0 AS `sort_order`
	UNION ALL SELECT 'pull', 'Pull', 'Back, biceps, rear delts', 0, 1
	UNION ALL SELECT 'legs', 'Legs', 'Quads, hammies, glutes', 0, 2
	UNION ALL SELECT 'cardio', 'Cardio', 'Conditioning & heart rate', 1, 3
) d;--> statement-breakpoint
UPDATE `workouts`
SET `day_id` = 'legacy-' || `user_id` || '-' || `day_type`,
	`day_name` = (SELECT `name` FROM `workout_days` WHERE `id` = 'legacy-' || `workouts`.`user_id` || '-' || `workouts`.`day_type`);--> statement-breakpoint
INSERT INTO `day_favorites` (`user_id`, `exercise_id`, `day_id`, `created_at`)
SELECT `user_id`, `exercise_id`, 'legacy-' || `user_id` || '-' || `day_type`, `created_at` FROM `exercise_favorites`;
