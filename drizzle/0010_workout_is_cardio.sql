ALTER TABLE `workouts` ADD `is_cardio` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Snapshot the day's cardio flag so history survives the day being edited or deleted.
UPDATE `workouts`
SET `is_cardio` = (SELECT `is_cardio` FROM `workout_days` WHERE `workout_days`.`id` = `workouts`.`day_id`)
WHERE `day_id` IS NOT NULL;
