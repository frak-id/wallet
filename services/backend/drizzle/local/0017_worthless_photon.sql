DROP INDEX "interaction_logs_unprocessed_idx";--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "available_at" timestamp;--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "interaction_logs" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
CREATE INDEX "interaction_logs_unprocessed_idx" ON "interaction_logs" USING btree ("created_at") WHERE "processed_at" IS NULL AND "cancelled_at" IS NULL AND "identity_group_id" IS NOT NULL;