CREATE TABLE IF NOT EXISTS "sso_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"sso_id" "bytea" NOT NULL,
	"product_id" "bytea" NOT NULL,
	"consume_key" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"wallet" "bytea",
	"authenticator_id" varchar
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sso_idx" ON "sso_session" USING btree ("sso_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sso_product_idx" ON "sso_session" USING btree ("sso_id","product_id");