DO $$ BEGIN
 CREATE TYPE "public"."product_oracle_platform" AS ENUM('shopify', 'woocommerce', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sso_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"sso_id" "bytea" NOT NULL,
	"product_id" "bytea" NOT NULL,
	"consume_key" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"wallet" "bytea",
	"authenticator_id" varchar
);
--> statement-breakpoint
-- Drop items that would conflict with the created index
DELETE FROM "product_oracle_purchase_item"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "product_oracle_purchase_item"
    GROUP BY "external_id", "purchase_id"
);
ALTER TABLE "product_oracle" ADD COLUMN "platform" "product_oracle_platform" DEFAULT 'shopify' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_oracle_purchase_item" ADD COLUMN "image_url" varchar;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sso_idx" ON "sso_session" USING btree ("sso_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sso_product_idx" ON "sso_session" USING btree ("sso_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_external_purchase_item_id" ON "product_oracle_purchase_item" USING btree ("external_id","purchase_id");