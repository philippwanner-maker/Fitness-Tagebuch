CREATE TABLE `friend_requests` (
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`sender_id`, `recipient_id`)
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `avatar` text DEFAULT '' NOT NULL;