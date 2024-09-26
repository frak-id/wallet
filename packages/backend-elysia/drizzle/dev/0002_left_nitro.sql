DO $$ BEGIN
 CREATE TYPE "public"."interactions_simulation_status" AS ENUM('pending', 'no_session', 'failed', 'succeeded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactions_pending" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"product_id" "bytea" NOT NULL,
	"type_denominator" "bytea" NOT NULL,
	"interaction_data" "bytea" NOT NULL,
	"signature" "bytea",
	"simulation_status" "interactions_simulation_status",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"locked" boolean DEFAULT false,
	CONSTRAINT "unique_interaction_per_status" UNIQUE("wallet","product_id","interaction_data","simulation_status")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactions_pushed" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"product_id" "bytea" NOT NULL,
	"type_denominator" "bytea" NOT NULL,
	"interaction_data" "bytea" NOT NULL,
	"signature" "bytea" NOT NULL,
	"tx_hash" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP INDEX IF EXISTS "wallet_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_pending_interactions_idx" ON "interactions_pending" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_idx" ON "interactions_pending" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_pushed_interactions_idx" ON "interactions_pushed" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_push_tokens_idx" ON "push_tokens" USING btree ("wallet");