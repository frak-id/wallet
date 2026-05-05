CREATE TABLE `authenticators` (
	`id` text PRIMARY KEY NOT NULL,
	`smart_wallet_address` text,
	`user_agent` text NOT NULL,
	`public_key_x` text NOT NULL,
	`public_key_y` text NOT NULL,
	`credential_public_key` text NOT NULL,
	`counter` integer NOT NULL,
	`credential_device_type` text NOT NULL,
	`credential_backed_up` integer NOT NULL,
	`transports` text
);
