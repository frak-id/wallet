CREATE TABLE "affiliate_attribution" (
	"token" varchar(64) PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"identity_group_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"tracking_link" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"tracking_link" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_sync_state" (
	"provider" text NOT NULL,
	"stream" varchar(64) NOT NULL,
	"watermark" timestamp with time zone,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_sync_state_provider_stream_pk" PRIMARY KEY("provider","stream")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_attribution_provider_user_brand_unique" ON "affiliate_attribution" USING btree ("provider","identity_group_id","merchant_id");--> statement-breakpoint
CREATE INDEX "affiliate_attribution_merchant_idx" ON "affiliate_attribution" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_brand_merchant_provider_unique" ON "affiliate_brand" USING btree ("merchant_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_brand_provider_external_unique" ON "affiliate_brand" USING btree ("provider","external_id");