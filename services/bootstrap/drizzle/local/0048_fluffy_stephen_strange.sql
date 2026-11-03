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
	"winner_identity_group_id" uuid,
	"confirmed_by" text,
	"confirmed_at" timestamp,
	"asset_log_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_draws_status_check" CHECK ("status" IN ('frozen', 'drawn', 'confirmed', 'void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "game_draws_game_idx" ON "game_draws" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_draws_status_idx" ON "game_draws" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interaction_logs_game_join_idx" ON "interaction_logs" USING btree ((payload->>'gameId'),"identity_group_id") WHERE "type" = 'game_join';