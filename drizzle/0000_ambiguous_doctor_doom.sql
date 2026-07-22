CREATE TABLE `demo_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`hedge_story` text NOT NULL,
	`available_balance` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_accounts_email_unique` ON `demo_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `demo_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`actor_id` text,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `demo_audit_created_idx` ON `demo_audit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `demo_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reference` text NOT NULL,
	`rail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_deposits_reference_unique` ON `demo_deposits` (`reference`);--> statement-breakpoint
CREATE INDEX `demo_deposits_user_idx` ON `demo_deposits` (`user_id`);--> statement-breakpoint
CREATE TABLE `demo_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market_id` text NOT NULL,
	`side` text NOT NULL,
	`notional` integer NOT NULL,
	`posted_price` real NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`counterparty_id` text,
	`match_price` real,
	`created_at` text NOT NULL,
	`matched_at` text
);
--> statement-breakpoint
CREATE INDEX `demo_orders_status_idx` ON `demo_orders` (`status`);--> statement-breakpoint
CREATE INDEX `demo_orders_market_idx` ON `demo_orders` (`market_id`);--> statement-breakpoint
CREATE TABLE `demo_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text NOT NULL,
	`counterparty_id` text NOT NULL,
	`market_id` text NOT NULL,
	`side` text NOT NULL,
	`notional` integer NOT NULL,
	`entry_price` real NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`signature` text
);
--> statement-breakpoint
CREATE INDEX `demo_positions_user_idx` ON `demo_positions` (`user_id`);--> statement-breakpoint
CREATE INDEX `demo_positions_market_idx` ON `demo_positions` (`market_id`);