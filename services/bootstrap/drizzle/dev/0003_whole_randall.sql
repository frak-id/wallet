CREATE TABLE IF NOT EXISTS "product_oracle_purchase_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" "bytea" NOT NULL,
	"external_id" varchar NOT NULL,
	"price" numeric NOT NULL,
	"name" varchar NOT NULL,
	"title" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_oracle_purchase_item" ADD CONSTRAINT "product_oracle_purchase_item_purchase_id_product_oracle_purchase_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."product_oracle_purchase"("purchase_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_purchase_id_idx" ON "product_oracle_purchase_item" USING btree ("purchase_id");