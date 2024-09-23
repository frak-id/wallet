CREATE TABLE IF NOT EXISTS "product_purchase_oracle" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" "bytea" NOT NULL,
	"external_app_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_purchase_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"oracle_id" serial NOT NULL,
	"external_id" varchar NOT NULL,
	"total_price" numeric NOT NULL,
	"currency_code" varchar(4) NOT NULL,
	"status" varchar NOT NULL,
	"leaf" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_status" UNIQUE("status")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_purchase_status" ADD CONSTRAINT "product_purchase_status_oracle_id_product_purchase_oracle_id_fk" FOREIGN KEY ("oracle_id") REFERENCES "public"."product_purchase_oracle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_product_id" ON "product_purchase_oracle" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_app_id" ON "product_purchase_oracle" USING btree ("external_app_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_external_id" ON "product_purchase_status" USING btree ("external_id","oracle_id");