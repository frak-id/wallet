CREATE TABLE "monerium_connections" (
	"wallet" "bytea" PRIMARY KEY NOT NULL,
	"monerium_user_id" varchar,
	"profile_id" varchar,
	"profile_kind" varchar(16),
	"profile_state" varchar(16),
	"profile_reason_code" varchar,
	"wallet_link_state" varchar(16) DEFAULT 'none' NOT NULL,
	"status" varchar(24) DEFAULT 'connected' NOT NULL,
	"access_token_encrypted" text,
	"access_token_expires_at" timestamp,
	"refresh_token_encrypted" text,
	"wallet_link_pending_at" timestamp,
	"profile_state_changed_at" timestamp,
	"siwe_failed_at" timestamp,
	"state_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monerium_pending_auths" (
	"state" varchar PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"method" varchar(8) NOT NULL,
	"code_verifier_encrypted" text NOT NULL,
	"siwe_message" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monerium_tracked_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"amount" varchar(32) NOT NULL,
	"state" varchar(16) NOT NULL,
	"placement_accepted" boolean DEFAULT false NOT NULL,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "monerium_connections_sync_idx" ON "monerium_connections" USING btree ("state_checked_at" NULLS FIRST) WHERE status = 'connected';--> statement-breakpoint
CREATE INDEX "monerium_pending_auths_wallet_idx" ON "monerium_pending_auths" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "monerium_pending_auths_expires_at_idx" ON "monerium_pending_auths" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "monerium_tracked_orders_wallet_idx" ON "monerium_tracked_orders" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "monerium_tracked_orders_sync_idx" ON "monerium_tracked_orders" USING btree ("last_checked_at" NULLS FIRST) WHERE state in ('placed', 'pending');