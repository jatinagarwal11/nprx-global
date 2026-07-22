ALTER TABLE `demo_accounts` ADD `owner_key` text;--> statement-breakpoint
ALTER TABLE `demo_accounts` ADD `claimed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `demo_accounts_owner_key_idx` ON `demo_accounts` (`owner_key`);