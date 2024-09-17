CREATE TABLE IF NOT EXISTS "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(255) NOT NULL,
	"endpoint" varchar NOT NULL,
	"key_p256dh" varchar NOT NULL,
	"key_auth" varchar NOT NULL,
	"expire_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_idx" ON "push_tokens" USING btree ("wallet");