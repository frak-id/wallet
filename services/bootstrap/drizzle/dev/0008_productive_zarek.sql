CREATE TYPE "public"."backend_interactions_tracker_source" AS ENUM('custom');--> statement-breakpoint
CREATE TABLE "backend_interactions_tracker" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" "bytea" NOT NULL,
	"hook_signature_key" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"source" "backend_interactions_tracker_source" DEFAULT 'custom' NOT NULL,
	CONSTRAINT "backend_interactions_tracker_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE INDEX "unique_tracker_product_id" ON "backend_interactions_tracker" USING btree ("product_id");