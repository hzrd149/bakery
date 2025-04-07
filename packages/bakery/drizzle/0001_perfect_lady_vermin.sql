CREATE TABLE `relay_info` (
	`url` text PRIMARY KEY NOT NULL,
	`info` text NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
