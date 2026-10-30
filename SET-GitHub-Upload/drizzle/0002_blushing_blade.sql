CREATE TABLE `community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`date` text NOT NULL,
	`captured_at` text NOT NULL,
	`image` text NOT NULL,
	`workout_name` text DEFAULT 'Freies Training' NOT NULL,
	`created_at` text NOT NULL
);
