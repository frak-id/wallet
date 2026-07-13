CREATE TABLE "business_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"email_verified_at" timestamp,
	"password_hash" text,
	"shopify_user_id" text,
	"shopify_shop_domain" text,
	"wallet_address" "bytea",
	"totp_secret_enc" "bytea",
	"totp_activated_at" timestamp,
	"totp_recovery_codes_hash" text[],
	"two_factor_attempts" integer DEFAULT 0 NOT NULL,
	"two_factor_window_started_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_email_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"send_count" integer DEFAULT 1 NOT NULL,
	"send_window_started_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "business_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"auth_method" text NOT NULL,
	"two_factor_verified_at" timestamp,
	"two_factor_nonce" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_documents" DROP CONSTRAINT "billing_documents_merchant_reference_uq";--> statement-breakpoint
ALTER TABLE "billing_document_counters" DROP CONSTRAINT "billing_document_counters_merchant_id_kind_year_pk";--> statement-breakpoint
ALTER TABLE "billing_documents" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "billing_documents" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "merchant_admins" ALTER COLUMN "wallet" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_admins" ALTER COLUMN "added_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_ownership_transfers" ALTER COLUMN "from_wallet" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_ownership_transfers" ALTER COLUMN "to_wallet" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "owner_wallet" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_document_counters" ADD CONSTRAINT "billing_document_counters_kind_year_pk" PRIMARY KEY("kind","year");--> statement-breakpoint
ALTER TABLE "merchant_admins" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "merchant_admins" ADD COLUMN "added_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "merchant_ownership_transfers" ADD COLUMN "from_account_id" uuid;--> statement-breakpoint
ALTER TABLE "merchant_ownership_transfers" ADD COLUMN "to_account_id" uuid;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "owner_account_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "business_accounts_email_idx" ON "business_accounts" USING btree ("email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "business_accounts_wallet_idx" ON "business_accounts" USING btree ("wallet_address") WHERE wallet_address IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "business_accounts_shopify_idx" ON "business_accounts" USING btree ("shopify_user_id","shopify_shop_domain") WHERE shopify_user_id IS NOT NULL AND shopify_shop_domain IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bec_account_purpose_idx" ON "business_email_codes" USING btree ("account_id","purpose");--> statement-breakpoint
CREATE INDEX "bec_expires_at_idx" ON "business_email_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "business_sessions_account_idx" ON "business_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "business_sessions_expires_idx" ON "business_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "merchant_admins_account_idx" ON "merchant_admins" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_admins_account_unique" ON "merchant_admins" USING btree ("merchant_id","account_id") WHERE account_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "merchants_owner_account_idx" ON "merchants" USING btree ("owner_account_id");--> statement-breakpoint
ALTER TABLE "billing_document_counters" DROP COLUMN "merchant_id";--> statement-breakpoint
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_reference_uq" UNIQUE("reference");--> statement-breakpoint
ALTER TABLE "merchant_admins" ADD CONSTRAINT "merchant_admins_identity_check" CHECK ("merchant_admins"."wallet" IS NOT NULL OR "merchant_admins"."account_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "merchant_ownership_transfers" ADD CONSTRAINT "merchant_ownership_transfers_from_check" CHECK ("merchant_ownership_transfers"."from_wallet" IS NOT NULL OR "merchant_ownership_transfers"."from_account_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "merchant_ownership_transfers" ADD CONSTRAINT "merchant_ownership_transfers_to_check" CHECK ("merchant_ownership_transfers"."to_wallet" IS NOT NULL OR "merchant_ownership_transfers"."to_account_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_check" CHECK ("merchants"."owner_wallet" IS NOT NULL OR "merchants"."owner_account_id" IS NOT NULL);