CREATE TABLE `demo_withdrawals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reference` text NOT NULL,
	`status` text DEFAULT 'simulated' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_withdrawals_reference_unique` ON `demo_withdrawals` (`reference`);--> statement-breakpoint
CREATE INDEX `demo_withdrawals_user_idx` ON `demo_withdrawals` (`user_id`);--> statement-breakpoint
ALTER TABLE `demo_accounts` ADD `funding_total` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `demo_accounts` ADD `withdrawn_total` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `demo_accounts` ADD `created_at` text DEFAULT '2026-07-22T00:00:00.000Z' NOT NULL;