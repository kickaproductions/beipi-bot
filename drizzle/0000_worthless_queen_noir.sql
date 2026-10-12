CREATE TABLE `companion_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`due` text,
	`done` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
