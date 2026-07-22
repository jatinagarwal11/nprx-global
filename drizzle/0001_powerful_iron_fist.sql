CREATE TABLE `demo_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`market_id` text NOT NULL,
	`long_user_id` text NOT NULL,
	`short_user_id` text NOT NULL,
	`notional` integer NOT NULL,
	`price` real NOT NULL,
	`status` text DEFAULT 'matched' NOT NULL,
	`chain_signature` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_trades_match_id_unique` ON `demo_trades` (`match_id`);--> statement-breakpoint
CREATE INDEX `demo_trades_market_idx` ON `demo_trades` (`market_id`);--> statement-breakpoint
CREATE INDEX `demo_trades_created_idx` ON `demo_trades` (`created_at`);