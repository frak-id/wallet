CREATE TABLE "instagram_access_tokens" (
	"account" text PRIMARY KEY NOT NULL,
	"token_encrypted" text NOT NULL,
	"seed_hash" text NOT NULL,
	"refreshed_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "game_draws" ADD COLUMN "notified_rank" integer DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_draws" ADD COLUMN "candidate_notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "game_draws" ADD COLUMN "reminded_rank" integer DEFAULT -1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_pending_links_identity_group_idx" ON "instagram_pending_links" USING btree ("identity_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_pending_links_code_idx" ON "instagram_pending_links" USING btree ("code");