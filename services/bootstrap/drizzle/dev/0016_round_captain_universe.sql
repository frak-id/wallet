CREATE TABLE "referral_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"referrer_identity_group_id" uuid NOT NULL,
	"referee_identity_group_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_links_merchant_referee_unique" UNIQUE("merchant_id","referee_identity_group_id")
);
--> statement-breakpoint
CREATE TABLE "touchpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_group_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_data" jsonb NOT NULL,
	"landing_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "campaign_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"rule" jsonb NOT NULL,
	"metadata" jsonb,
	"budget_config" jsonb,
	"budget_used" jsonb DEFAULT '{}'::jsonb,
	"expires_at" timestamp,
	"published_at" timestamp,
	"deactivated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merged_groups" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "identity_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"identity_type" text NOT NULL,
	"identity_value" text NOT NULL,
	"merchant_id" uuid,
	"validation_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "identity_nodes_unique_identity" UNIQUE("identity_type","identity_value","merchant_id")
);
--> statement-breakpoint
CREATE TABLE "merchant_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"wallet" "bytea" NOT NULL,
	"added_by" "bytea" NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_admins_unique" UNIQUE("merchant_id","wallet")
);
--> statement-breakpoint
CREATE TABLE "merchant_ownership_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"from_wallet" "bytea" NOT NULL,
	"to_wallet" "bytea" NOT NULL,
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "merchant_ownership_transfers_merchant_id_unique" UNIQUE("merchant_id")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" "bytea",
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"owner_wallet" "bytea" NOT NULL,
	"bank_address" "bytea",
	"default_reward_token" "bytea" NOT NULL,
	"webhook_signature_key" text,
	"webhook_platform" text,
	"config" jsonb,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "merchants_product_id_unique" UNIQUE("product_id"),
	CONSTRAINT "merchants_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "merchant_webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"hook_signature_key" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"platform" text DEFAULT 'shopify' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"purchase_token" varchar NOT NULL,
	"claiming_identity_group_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"external_id" varchar NOT NULL,
	"price" numeric NOT NULL,
	"name" varchar NOT NULL,
	"title" varchar NOT NULL,
	"image_url" varchar,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" integer NOT NULL,
	"external_id" varchar NOT NULL,
	"external_customer_id" varchar NOT NULL,
	"purchase_token" varchar,
	"total_price" numeric NOT NULL,
	"currency_code" varchar(4) NOT NULL,
	"status" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"identity_group_id" uuid
);
--> statement-breakpoint
CREATE TABLE "asset_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_group_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"campaign_rule_id" uuid,
	"asset_type" text NOT NULL,
	"amount" numeric(36, 18) NOT NULL,
	"token_address" "bytea",
	"recipient_type" text NOT NULL,
	"recipient_wallet" "bytea",
	"chain_depth" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_changed_at" timestamp DEFAULT now() NOT NULL,
	"touchpoint_id" uuid,
	"interaction_log_id" uuid,
	"onchain_tx_hash" "bytea",
	"onchain_block" bigint,
	"settlement_attempts" integer DEFAULT 0 NOT NULL,
	"last_settlement_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "interaction_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"identity_group_id" uuid,
	"merchant_id" uuid,
	"external_event_id" text,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "interactions_archived" CASCADE;--> statement-breakpoint
DROP TABLE "backend_interactions_tracker" CASCADE;--> statement-breakpoint
DROP TABLE "interactions_purchase_tracker" CASCADE;--> statement-breakpoint
DROP TABLE "interactions_pending" CASCADE;--> statement-breakpoint
DROP TABLE "interactions_pushed" CASCADE;--> statement-breakpoint
DROP TABLE "product_oracle" CASCADE;--> statement-breakpoint
DROP TABLE "product_oracle_purchase_item" CASCADE;--> statement-breakpoint
DROP TABLE "product_oracle_purchase" CASCADE;--> statement-breakpoint
ALTER TABLE "device_pairing" ADD COLUMN "origin_node" jsonb;--> statement-breakpoint
CREATE INDEX "referral_links_merchant_idx" ON "referral_links" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "referral_links_referrer_idx" ON "referral_links" USING btree ("referrer_identity_group_id");--> statement-breakpoint
CREATE INDEX "referral_links_referee_idx" ON "referral_links" USING btree ("referee_identity_group_id");--> statement-breakpoint
CREATE INDEX "touchpoints_identity_group_idx" ON "touchpoints" USING btree ("identity_group_id");--> statement-breakpoint
CREATE INDEX "touchpoints_merchant_idx" ON "touchpoints" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "touchpoints_identity_merchant_idx" ON "touchpoints" USING btree ("identity_group_id","merchant_id");--> statement-breakpoint
CREATE INDEX "touchpoints_expires_at_idx" ON "touchpoints" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "campaign_rules_merchant_idx" ON "campaign_rules" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "campaign_rules_merchant_status_idx" ON "campaign_rules" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "campaign_rules_priority_idx" ON "campaign_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "identity_nodes_group_idx" ON "identity_nodes" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "identity_nodes_type_value_idx" ON "identity_nodes" USING btree ("identity_type","identity_value");--> statement-breakpoint
CREATE INDEX "identity_nodes_merchant_idx" ON "identity_nodes" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_admins_merchant_idx" ON "merchant_admins" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_admins_wallet_idx" ON "merchant_admins" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "merchant_ownership_transfers_to_wallet_idx" ON "merchant_ownership_transfers" USING btree ("to_wallet");--> statement-breakpoint
CREATE INDEX "merchants_product_id_idx" ON "merchants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "merchants_domain_idx" ON "merchants" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "merchants_owner_wallet_idx" ON "merchants" USING btree ("owner_wallet");--> statement-breakpoint
CREATE INDEX "merchant_webhooks_merchant_id_idx" ON "merchant_webhooks" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_claims_unique_purchase" ON "purchase_claims" USING btree ("merchant_id","order_id","purchase_token");--> statement-breakpoint
CREATE INDEX "purchase_claims_identity_group_idx" ON "purchase_claims" USING btree ("claiming_identity_group_id");--> statement-breakpoint
CREATE INDEX "purchase_claims_merchant_idx" ON "purchase_claims" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_items_external_id_idx" ON "purchase_items" USING btree ("external_id","purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_external_id_webhook_idx" ON "purchases" USING btree ("external_id","webhook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_external_listener_idx" ON "purchases" USING btree ("external_id","purchase_token");--> statement-breakpoint
CREATE INDEX "purchases_identity_group_idx" ON "purchases" USING btree ("identity_group_id");--> statement-breakpoint
CREATE INDEX "purchases_webhook_id_idx" ON "purchases" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "asset_logs_identity_group_idx" ON "asset_logs" USING btree ("identity_group_id");--> statement-breakpoint
CREATE INDEX "asset_logs_merchant_idx" ON "asset_logs" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "asset_logs_campaign_rule_idx" ON "asset_logs" USING btree ("campaign_rule_id");--> statement-breakpoint
CREATE INDEX "asset_logs_status_idx" ON "asset_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "asset_logs_status_merchant_idx" ON "asset_logs" USING btree ("status","merchant_id");--> statement-breakpoint
CREATE INDEX "asset_logs_recipient_wallet_idx" ON "asset_logs" USING btree ("recipient_wallet");--> statement-breakpoint
CREATE INDEX "asset_logs_interaction_log_idx" ON "asset_logs" USING btree ("interaction_log_id");--> statement-breakpoint
CREATE INDEX "asset_logs_created_at_idx" ON "asset_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "asset_logs_settlement_retry_idx" ON "asset_logs" USING btree ("status","settlement_attempts");--> statement-breakpoint
CREATE INDEX "asset_logs_settlement_pending_idx" ON "asset_logs" USING btree ("status","asset_type","settlement_attempts","created_at");--> statement-breakpoint
CREATE INDEX "asset_logs_expires_at_idx" ON "asset_logs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "interaction_logs_identity_group_idx" ON "interaction_logs" USING btree ("identity_group_id");--> statement-breakpoint
CREATE INDEX "interaction_logs_merchant_idx" ON "interaction_logs" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "interaction_logs_type_idx" ON "interaction_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "interaction_logs_created_at_idx" ON "interaction_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "interaction_logs_processed_at_idx" ON "interaction_logs" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interaction_logs_external_event_unique_idx" ON "interaction_logs" USING btree ("merchant_id","type","external_event_id");--> statement-breakpoint
-- DROP TYPE "public"."interactions_archive_reason";--> statement-breakpoint
-- DROP TYPE "public"."backend_interactions_tracker_source";--> statement-breakpoint
-- DROP TYPE "public"."interactions_simulation_status";--> statement-breakpoint
-- DROP TYPE "public"."product_oracle_platform";--> statement-breakpoint
-- DROP TYPE "public"."purchase_status";