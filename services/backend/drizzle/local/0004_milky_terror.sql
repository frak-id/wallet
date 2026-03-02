DROP INDEX "merchant_webhooks_merchant_id_idx";--> statement-breakpoint
ALTER TABLE "pairing_signature_request" ADD COLUMN "expires_at" timestamp NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_webhooks_merchant_id_idx" ON "merchant_webhooks" USING btree ("merchant_id");