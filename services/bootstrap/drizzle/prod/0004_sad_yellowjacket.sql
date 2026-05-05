CREATE TABLE "pairing_signature_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" varchar NOT NULL,
	"pairing_id" varchar NOT NULL,
	"request" "bytea" NOT NULL,
	"context" json,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	"signature" "bytea"
);
--> statement-breakpoint
CREATE TABLE "device_pairing" (
	"id" serial PRIMARY KEY NOT NULL,
	"pairing_id" varchar NOT NULL,
	"wallet" "bytea",
	"sso_id" "bytea",
	"origin_user_agent" varchar NOT NULL,
	"origin_name" varchar NOT NULL,
	"target_user_agent" varchar,
	"target_name" varchar,
	"pairing_code" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"last_active_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sso_session" ADD COLUMN "pairing_id" varchar;--> statement-breakpoint
CREATE INDEX "request_id_idx" ON "pairing_signature_request" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "signature_pairing_id_idx" ON "pairing_signature_request" USING btree ("pairing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pairing_id_idx" ON "device_pairing" USING btree ("pairing_id");--> statement-breakpoint
CREATE INDEX "wallet_id_idx" ON "device_pairing" USING btree ("wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "pairing_code_idx" ON "device_pairing" USING btree ("pairing_code");