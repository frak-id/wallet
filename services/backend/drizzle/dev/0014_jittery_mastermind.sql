CREATE TYPE "public"."interactions_archive_reason" AS ENUM('max_retries', 'expired', 'manual');--> statement-breakpoint
ALTER TYPE "public"."interactions_simulation_status" ADD VALUE 'execution_failed';--> statement-breakpoint
CREATE TABLE "interactions_archived" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"product_id" "bytea" NOT NULL,
	"type_denominator" "bytea" NOT NULL,
	"interaction_data" "bytea" NOT NULL,
	"signature" "bytea",
	"final_status" "interactions_simulation_status" NOT NULL,
	"failure_reason" varchar(500),
	"total_retries" integer NOT NULL,
	"archive_reason" "interactions_archive_reason" NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	"original_created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "6degrees_fixed_routing" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "6degrees_wallet_routing" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "6degrees_fixed_routing" CASCADE;--> statement-breakpoint
DROP TABLE "6degrees_wallet_routing" CASCADE;--> statement-breakpoint
ALTER TABLE "interactions_pending" ADD COLUMN "failure_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "interactions_pending" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions_pending" ADD COLUMN "last_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "interactions_pending" ADD COLUMN "next_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "interactions_pending" ADD COLUMN "locked_at" timestamp;--> statement-breakpoint
CREATE INDEX "wallet_archived_interactions_idx" ON "interactions_archived" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "archived_at_idx" ON "interactions_archived" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "archive_reason_idx" ON "interactions_archived" USING btree ("archive_reason");--> statement-breakpoint
CREATE INDEX "status_idx" ON "interactions_pending" USING btree ("simulation_status");--> statement-breakpoint
CREATE INDEX "next_retry_idx" ON "interactions_pending" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "locked_at_idx" ON "interactions_pending" USING btree ("locked_at");--> statement-breakpoint
ALTER TABLE "interactions_pending" DROP COLUMN "locked";