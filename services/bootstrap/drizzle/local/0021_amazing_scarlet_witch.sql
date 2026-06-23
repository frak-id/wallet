CREATE TABLE "authenticator_wallet_bindings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"authenticator_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"smart_wallet_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"unlinked_at" timestamp,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "awb_active_idx" ON "authenticator_wallet_bindings" USING btree ("authenticator_id","chain_id") WHERE unlinked_at IS NULL;--> statement-breakpoint
CREATE INDEX "awb_wallet_chain_idx" ON "authenticator_wallet_bindings" USING btree ("smart_wallet_address","chain_id") WHERE unlinked_at IS NULL;