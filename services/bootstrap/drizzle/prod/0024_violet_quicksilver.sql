CREATE TABLE "game_draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"algorithm" text NOT NULL,
	"status" text NOT NULL,
	"frozen_at" timestamp NOT NULL,
	"pid_key" text NOT NULL,
	"snapshot_root" text NOT NULL,
	"total_tickets" integer NOT NULL,
	"entries" jsonb NOT NULL,
	"drand_chain_hash" text NOT NULL,
	"drand_round" integer NOT NULL,
	"drand_signature" text,
	"candidates" jsonb,
	"rejections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notified_rank" integer DEFAULT -1 NOT NULL,
	"candidate_notified_at" timestamp,
	"reminded_rank" integer DEFAULT -1 NOT NULL,
	"winner_identity_group_id" uuid,
	"confirmed_by" text,
	"confirmed_at" timestamp,
	"asset_log_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_draws_status_check" CHECK ("status" IN ('frozen', 'drawn', 'confirmed', 'void'))
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
CREATE TABLE "instagram_access_tokens" (
	"account" text PRIMARY KEY NOT NULL,
	"token_encrypted" text NOT NULL,
	"seed_hash" text NOT NULL,
	"refreshed_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_group_id" uuid NOT NULL,
	"igsid" text NOT NULL,
	"username" text NOT NULL,
	"follows" boolean NOT NULL,
	"checked_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_pending_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_group_id" uuid NOT NULL,
	"username" text,
	"declared_at" timestamp,
	"code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_pending_links_declared_check" CHECK (("username" IS NULL) = ("declared_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "held_at" timestamp;--> statement-breakpoint
ALTER TABLE "asset_logs" ADD COLUMN "released_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "game_draws_game_idx" ON "game_draws" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_draws_status_idx" ON "game_draws" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "games_referral_code_idx" ON "games" USING btree ("referral_code_id");--> statement-breakpoint
CREATE INDEX "games_ends_at_idx" ON "games" USING btree ("ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_links_identity_group_idx" ON "instagram_links" USING btree ("identity_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_links_igsid_idx" ON "instagram_links" USING btree ("igsid");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_pending_links_identity_group_idx" ON "instagram_pending_links" USING btree ("identity_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_pending_links_code_idx" ON "instagram_pending_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "asset_logs_held_idx" ON "asset_logs" USING btree ("released_at") WHERE "held_at" IS NOT NULL AND "status" IN ('pending', 'bank_depleted');--> statement-breakpoint
CREATE INDEX "interaction_logs_game_join_idx" ON "interaction_logs" USING btree ((payload->>'gameId'),"identity_group_id") WHERE "type" = 'game_join';