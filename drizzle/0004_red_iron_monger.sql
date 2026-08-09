CREATE TABLE `user_exercise_cardio_prefs` (
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`unit_label` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `exercise_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_exercise_cardio_prefs_user_idx` ON `user_exercise_cardio_prefs` (`user_id`);--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `metric_value` real;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `duration_seconds` integer;