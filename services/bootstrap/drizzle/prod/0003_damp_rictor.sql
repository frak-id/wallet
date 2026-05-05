CREATE TABLE "6degrees_fixed_routing" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar NOT NULL,
	"campaign_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "6degrees_wallet_routing" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_pub_key" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sso_session" ADD COLUMN "additional_data" json;--> statement-breakpoint
CREATE UNIQUE INDEX "6degrees_routing_domain" ON "6degrees_fixed_routing" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "6degrees_routing_wallet" ON "6degrees_wallet_routing" USING btree ("wallet_pub_key");