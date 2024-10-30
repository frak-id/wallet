DO $$ BEGIN
 CREATE TYPE "public"."product_oracle_plateform" AS ENUM('shopify', 'woocommerce', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "product_oracle" ADD COLUMN "plateform" "product_oracle_plateform" DEFAULT 'shopify' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_oracle_purchase_item" ADD COLUMN "image_url" varchar;