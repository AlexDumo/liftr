ALTER TABLE `exercises` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `exercises_userId_name_idx` ON `exercises` (`user_id`,`name`);