ALTER TABLE "merchants" ADD COLUMN "explorer_config" jsonb;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "explorer_enabled_at" timestamp;--> statement-breakpoint
ALTER TABLE "merchants" DROP COLUMN IF EXISTS "config";
