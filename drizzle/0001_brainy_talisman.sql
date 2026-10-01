CREATE TABLE `project_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`activity_date` text,
	`status` text NOT NULL,
	`progress_note` text DEFAULT '' NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_project_updates_project` ON `project_updates` (`project_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `projects` ADD `progress_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `updated_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `updated_at` integer DEFAULT 0 NOT NULL;