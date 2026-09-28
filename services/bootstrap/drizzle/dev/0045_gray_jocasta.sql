DROP INDEX "referral_codes_owner_active_idx";--> statement-breakpoint
ALTER TABLE "referral_codes" ADD COLUMN "kind" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_logs_welcome_bonus_live_idx" ON "asset_logs" USING btree ("identity_group_id","merchant_id") WHERE "recipient_type" = 'welcome_bonus' AND "status" IN ('pending', 'processing', 'settled', 'bank_depleted');--> statement-breakpoint
CREATE UNIQUE INDEX "referral_codes_owner_active_idx" ON "referral_codes" USING btree ("owner_identity_group_id") WHERE "revoked_at" IS NULL AND "kind" = 'user';--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_kind_check" CHECK ("kind" IN ('user', 'frak'));