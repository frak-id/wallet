DROP INDEX "merchant_webhooks_merchant_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_webhooks_merchant_id_idx" ON "merchant_webhooks" USING btree ("merchant_id");