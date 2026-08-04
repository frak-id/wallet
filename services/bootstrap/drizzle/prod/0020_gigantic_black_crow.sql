ALTER TABLE "identity_nodes" ADD COLUMN "proof_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "install_codes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "allowed_package_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "sku" varchar;--> statement-breakpoint
CREATE INDEX "merchants_allowed_package_ids_idx" ON "merchants" USING gin ("allowed_package_ids");--> statement-breakpoint
ALTER TABLE "device_pairing" DROP COLUMN "origin_node";