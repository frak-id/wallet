DROP INDEX "purchase_items_external_id_idx";--> statement-breakpoint
ALTER TABLE "install_codes" ALTER COLUMN "anonymous_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "install_codes" ADD COLUMN "checkout_token" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "total_price" numeric;--> statement-breakpoint
CREATE INDEX "install_codes_merchant_checkout_token_idx" ON "install_codes" USING btree ("merchant_id","checkout_token");--> statement-breakpoint
CREATE INDEX "purchase_claims_merchant_token_idx" ON "purchase_claims" USING btree ("merchant_id","purchase_token");--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_line_idx" UNIQUE NULLS NOT DISTINCT("purchase_id","external_id","sku");--> statement-breakpoint
ALTER TABLE "install_codes" ADD CONSTRAINT "install_codes_credential_present" CHECK ("anonymous_id" IS NOT NULL OR "checkout_token" IS NOT NULL);