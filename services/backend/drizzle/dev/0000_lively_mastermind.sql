CREATE TABLE IF NOT EXISTS "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"endpoint" varchar NOT NULL,
	"key_p256dh" varchar NOT NULL,
	"key_auth" varchar NOT NULL,
	"expire_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_push_token" UNIQUE("wallet","endpoint","key_p256dh")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_idx" ON "push_tokens" USING btree ("wallet");