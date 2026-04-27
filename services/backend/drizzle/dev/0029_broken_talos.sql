ALTER TABLE "asset_logs" ADD COLUMN "available_at" timestamp;--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
CREATE INDEX "asset_logs_pending_available_idx" ON "asset_logs" USING btree ("available_at") WHERE "status" = 'pending' AND "available_at" IS NOT NULL;