CREATE TABLE "drops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code_id" uuid NOT NULL,
	"campaign_rule_id" uuid NOT NULL,
	"sponsor_merchant_id" uuid,
	"prize_description" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drops_status_check" CHECK ("status" IN ('active', 'paused')),
	CONSTRAINT "drops_window_check" CHECK ("ends_at" > "starts_at")
);
--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "held_at" timestamp;--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "released_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "drops_referral_code_idx" ON "drops" USING btree ("referral_code_id");--> statement-breakpoint
CREATE INDEX "drops_ends_at_idx" ON "drops" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "asset_logs_held_idx" ON "asset_logs" USING btree ("released_at") WHERE "held_at" IS NOT NULL AND "status" IN ('pending', 'bank_depleted');