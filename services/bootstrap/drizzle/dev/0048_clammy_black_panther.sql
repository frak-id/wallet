CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code_id" uuid NOT NULL,
	"campaign_rule_id" uuid NOT NULL,
	"sponsor_merchant_id" uuid,
	"prize_amount" numeric(12, 2) NOT NULL,
	"prize_description" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_status_check" CHECK ("status" IN ('active', 'paused')),
	CONSTRAINT "games_window_check" CHECK ("ends_at" > "starts_at"),
	CONSTRAINT "games_prize_amount_check" CHECK ("prize_amount" > 0)
);
--> statement-breakpoint
DROP TABLE "drops" CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "games_referral_code_idx" ON "games" USING btree ("referral_code_id");--> statement-breakpoint
CREATE INDEX "games_ends_at_idx" ON "games" USING btree ("ends_at");