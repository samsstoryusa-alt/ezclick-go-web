CREATE TABLE `site_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`plan` text NOT NULL,
	`message` text NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`request_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inquiries_request_time` ON `site_inquiries` (`request_hash`,`created_at`);