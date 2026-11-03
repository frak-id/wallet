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
CREATE UNIQUE INDEX "instagram_links_identity_group_idx" ON "instagram_links" USING btree ("identity_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_links_igsid_idx" ON "instagram_links" USING btree ("igsid");