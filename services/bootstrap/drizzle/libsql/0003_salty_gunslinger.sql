CREATE TABLE `authenticator_wallet_bindings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`authenticator_id` text NOT NULL,
	`chain_id` integer NOT NULL,
	`smart_wallet_address` text NOT NULL,
	`recovery_blob` text,
	`created_at` integer NOT NULL,
	`unlinked_at` integer,
	`reason` text NOT NULL,
	FOREIGN KEY (`authenticator_id`) REFERENCES `authenticators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `awb_active_idx` ON `authenticator_wallet_bindings` (`authenticator_id`,`chain_id`) WHERE "unlinked_at" IS NULL;--> statement-breakpoint
CREATE INDEX `awb_wallet_chain_idx` ON `authenticator_wallet_bindings` (`smart_wallet_address`,`chain_id`) WHERE "unlinked_at" IS NULL;