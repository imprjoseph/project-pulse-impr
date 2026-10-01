CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client` text DEFAULT '' NOT NULL,
	`activity_date` text,
	`pm_name` text NOT NULL,
	`status` text DEFAULT '進行中' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text NOT NULL,
	`week_start` text NOT NULL,
	`highlights` text DEFAULT '' NOT NULL,
	`blockers` text DEFAULT '' NOT NULL,
	`next_week_focus` text DEFAULT '' NOT NULL,
	`submitted_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_weekly_reports_user_week` ON `weekly_reports` (`user_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `idx_weekly_reports_week` ON `weekly_reports` (`week_start`);--> statement-breakpoint
CREATE TABLE `work_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`week_start` text NOT NULL,
	`project_id` text NOT NULL,
	`task_name` text NOT NULL,
	`category` text NOT NULL,
	`regular_hours` real DEFAULT 0 NOT NULL,
	`overtime_hours` real DEFAULT 0 NOT NULL,
	`overtime_reason` text DEFAULT '' NOT NULL,
	`progress` text DEFAULT '' NOT NULL,
	`difficulty_type` text DEFAULT '無' NOT NULL,
	`difficulty_note` text DEFAULT '' NOT NULL,
	`support_needed` text DEFAULT '' NOT NULL,
	`next_week_hours` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `weekly_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_work_logs_project_week` ON `work_logs` (`project_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `idx_work_logs_user_week` ON `work_logs` (`user_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `idx_work_logs_report` ON `work_logs` (`report_id`);