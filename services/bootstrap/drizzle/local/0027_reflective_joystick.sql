ALTER TABLE "notification_broadcasts" ADD COLUMN "targets" jsonb;--> statement-breakpoint
ALTER TABLE "notification_broadcasts" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification_broadcasts" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
CREATE INDEX "notification_broadcasts_scheduled_at_idx" ON "notification_broadcasts" USING btree ("scheduled_at");