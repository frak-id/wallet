ALTER TABLE "notification_broadcasts" ADD COLUMN "targets" jsonb;--> statement-breakpoint
ALTER TABLE "notification_broadcasts" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification_broadcasts" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
CREATE INDEX "notification_broadcasts_scheduled_at_idx" ON "notification_broadcasts" USING btree ("scheduled_at") WHERE "notification_broadcasts"."scheduled_at" is not null and "notification_broadcasts"."claimed_at" is null;--> statement-breakpoint
CREATE INDEX "notification_sent_broadcast_idx" ON "notification_sent" USING btree ("broadcast_id");