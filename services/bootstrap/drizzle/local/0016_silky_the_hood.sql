CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(6) NOT NULL,
	"owner_identity_group_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "touchpoints" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "touchpoints" CASCADE;--> statement-breakpoint
ALTER TABLE "referral_links" DROP CONSTRAINT "referral_links_merchant_referee_unique";--> statement-breakpoint
ALTER TABLE "referral_links" ALTER COLUMN "merchant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "referral_links" ADD COLUMN "scope" text DEFAULT 'merchant' NOT NULL;--> statement-breakpoint
ALTER TABLE "referral_links" ADD COLUMN "source" text DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "referral_links" ADD COLUMN "source_data" jsonb;--> statement-breakpoint
ALTER TABLE "referral_links" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "referral_link_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_codes_code_active_idx" ON "referral_codes" USING btree ("code") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_codes_owner_active_idx" ON "referral_codes" USING btree ("owner_identity_group_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_links_merchant_referee_unique" ON "referral_links" USING btree ("merchant_id","referee_identity_group_id") WHERE "scope" = 'merchant';--> statement-breakpoint
CREATE UNIQUE INDEX "referral_links_cross_merchant_referee_unique" ON "referral_links" USING btree ("referee_identity_group_id") WHERE "scope" = 'cross_merchant';--> statement-breakpoint
ALTER TABLE "asset_logs" DROP COLUMN "touchpoint_id";--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_scope_merchant_check" CHECK (("scope" = 'merchant' AND "merchant_id" IS NOT NULL) OR ("scope" = 'cross_merchant' AND "merchant_id" IS NULL));--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_no_self_loop_check" CHECK ("referrer_identity_group_id" <> "referee_identity_group_id");