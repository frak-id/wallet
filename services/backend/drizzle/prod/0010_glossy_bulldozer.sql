ALTER TABLE "merchants" ADD COLUMN "explorer_config" jsonb;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "explorer_enabled_at" timestamp;--> statement-breakpoint
CREATE INDEX "interaction_logs_sharing_timestamp_idx" ON "interaction_logs" USING btree (((payload->>'sharingTimestamp')::int)) WHERE "type" = 'create_referral_link';--> statement-breakpoint
ALTER TABLE "merchants" DROP COLUMN "config";