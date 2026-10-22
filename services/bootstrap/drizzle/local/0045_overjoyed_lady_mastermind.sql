CREATE TABLE "game_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"identity_group_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"identity_group_id" uuid NOT NULL,
	"interaction_log_id" uuid NOT NULL,
	"source" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_tickets_source_check" CHECK ("source" IN ('friend_signup', 'purchase', 'referred_purchase')),
	CONSTRAINT "game_tickets_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
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
CREATE UNIQUE INDEX "game_participants_game_identity_idx" ON "game_participants" USING btree ("game_id","identity_group_id");--> statement-breakpoint
CREATE INDEX "game_participants_identity_idx" ON "game_participants" USING btree ("identity_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_tickets_source_idx" ON "game_tickets" USING btree ("game_id","interaction_log_id","source");--> statement-breakpoint
CREATE INDEX "game_tickets_holder_idx" ON "game_tickets" USING btree ("game_id","identity_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_referral_code_idx" ON "games" USING btree ("referral_code_id");--> statement-breakpoint
CREATE INDEX "games_ends_at_idx" ON "games" USING btree ("ends_at");