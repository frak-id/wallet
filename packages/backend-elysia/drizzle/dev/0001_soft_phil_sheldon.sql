DO $$ BEGIN
 CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'confirmed', 'cancelled', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_oracle" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" "bytea" NOT NULL,
	"hook_signature_key" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"merkle_root" "bytea",
	CONSTRAINT "product_oracle_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_oracle_purchase" (
	"id" serial PRIMARY KEY NOT NULL,
	"oracle_id" integer NOT NULL,
	"purchase_id" "bytea" NOT NULL,
	"external_id" varchar NOT NULL,
	"total_price" numeric NOT NULL,
	"currency_code" varchar(4) NOT NULL,
	"status" "purchase_status",
	"leaf" "bytea",
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "product_oracle_purchase_purchase_id_unique" UNIQUE("purchase_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_oracle_purchase" ADD CONSTRAINT "product_oracle_purchase_oracle_id_product_oracle_id_fk" FOREIGN KEY ("oracle_id") REFERENCES "public"."product_oracle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unique_product_id" ON "product_oracle" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_external_id" ON "product_oracle_purchase" USING btree ("external_id","oracle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_id_idx" ON "product_oracle_purchase" USING btree ("purchase_id");