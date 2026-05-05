DROP INDEX "referral_links_merchant_referee_unique";--> statement-breakpoint
DROP INDEX "referral_links_cross_merchant_referee_unique";--> statement-breakpoint
ALTER TABLE "referral_links" ADD COLUMN "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "referral_links" ADD COLUMN "end_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_links_merchant_referee_unique" ON "referral_links" USING btree ("merchant_id","referee_identity_group_id") WHERE "scope" = 'merchant' AND "removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_links_cross_merchant_referee_unique" ON "referral_links" USING btree ("referee_identity_group_id") WHERE "scope" = 'cross_merchant' AND "removed_at" IS NULL;