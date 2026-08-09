CREATE TABLE `exercise_favorites` (
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`day_type` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `exercise_id`, `day_type`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exercise_favorites_user_day_idx` ON `exercise_favorites` (`user_id`,`day_type`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`force` text,
	`level` text NOT NULL,
	`mechanic` text,
	`equipment` text,
	`category` text NOT NULL,
	`primary_muscles` text NOT NULL,
	`secondary_muscles` text NOT NULL,
	`instructions` text NOT NULL,
	`images` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exercises_name_idx` ON `exercises` (`name`);--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `workout_exercises_workoutId_idx` ON `workout_exercises` (`workout_id`);--> statement-breakpoint
CREATE INDEX `workout_exercises_exerciseId_idx` ON `workout_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`weight` real,
	`reps` integer,
	FOREIGN KEY (`workout_exercise_id`) REFERENCES `workout_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_sets_workoutExerciseId_idx` ON `workout_sets` (`workout_exercise_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sets_exercise_set_uidx` ON `workout_sets` (`workout_exercise_id`,`set_index`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day_type` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workouts_userId_idx` ON `workouts` (`user_id`);--> statement-breakpoint
CREATE INDEX `workouts_user_status_idx` ON `workouts` (`user_id`,`status`);