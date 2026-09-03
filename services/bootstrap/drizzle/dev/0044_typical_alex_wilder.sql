DROP INDEX "purchase_items_external_id_idx";--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "total_price" numeric;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_line_idx" UNIQUE NULLS NOT DISTINCT("purchase_id","external_id","sku");