CREATE TABLE `application_state` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text
);
--> statement-breakpoint
CREATE TABLE `decryption_cache` (
	`event` text(64) PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`event`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text(64) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`pubkey` text(64) NOT NULL,
	`sig` text NOT NULL,
	`kind` integer NOT NULL,
	`content` text NOT NULL,
	`tags` text NOT NULL,
	`identifier` text
);
--> statement-breakpoint
CREATE INDEX `created_at` ON `events` (`created_at`);--> statement-breakpoint
CREATE INDEX `pubkey` ON `events` (`pubkey`);--> statement-breakpoint
CREATE INDEX `kind` ON `events` (`kind`);--> statement-breakpoint
CREATE INDEX `identifier` ON `events` (`identifier`);--> statement-breakpoint
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer,
	`service` text NOT NULL,
	`message` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text(64) NOT NULL,
	`tag` text(1) NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`event`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event` ON `tags` (`event`);--> statement-breakpoint
CREATE INDEX `tag` ON `tags` (`tag`);--> statement-breakpoint
CREATE INDEX `value` ON `tags` (`value`);