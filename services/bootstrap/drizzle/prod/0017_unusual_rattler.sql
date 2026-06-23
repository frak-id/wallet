CREATE TABLE "authenticator_wallet_bindings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"authenticator_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"smart_wallet_address" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"unlinked_at" timestamp,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code" varchar(6) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	CONSTRAINT "email_verification_codes_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "recovery_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"blob" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recovery_blobs_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
DROP INDEX "asset_logs_pending_expirable_idx";--> statement-breakpoint
ALTER TABLE "identity_nodes" ADD COLUMN "unlinked_at" timestamp;--> statement-breakpoint
ALTER TABLE "identity_nodes" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "pairing_signature_request" ADD COLUMN "kind" varchar;--> statement-breakpoint
ALTER TABLE "device_pairing" ADD COLUMN "authenticator_id" varchar;--> statement-breakpoint
ALTER TABLE "device_pairing" ADD COLUMN "authenticator_hints" varchar[];--> statement-breakpoint
CREATE UNIQUE INDEX "awb_active_idx" ON "authenticator_wallet_bindings" USING btree ("authenticator_id","chain_id") WHERE unlinked_at IS NULL;--> statement-breakpoint
CREATE INDEX "awb_wallet_chain_idx" ON "authenticator_wallet_bindings" USING btree ("smart_wallet_address","chain_id") WHERE unlinked_at IS NULL;--> statement-breakpoint
CREATE INDEX "evc_expires_at_idx" ON "email_verification_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "asset_logs_pending_expirable_idx" ON "asset_logs" USING btree ("expires_at") WHERE "status" IN ('pending', 'bank_depleted') AND "expires_at" IS NOT NULL;