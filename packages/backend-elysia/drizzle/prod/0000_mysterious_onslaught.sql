DO $$ BEGIN
 CREATE TYPE "public"."interactions_simulation_status" AS ENUM('pending', 'no_session', 'failed', 'succeeded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'confirmed', 'cancelled', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactions_purchase_tracker" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"external_purchase_id" varchar NOT NULL,
	"external_customer_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"pushed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_map_idx" UNIQUE("external_purchase_id","external_customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactions_pending" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"product_id" "bytea" NOT NULL,
	"type_denominator" "bytea" NOT NULL,
	"interaction_data" "bytea" NOT NULL,
	"signature" "bytea",
	"simulation_status" "interactions_simulation_status",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"locked" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactions_pushed" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"product_id" "bytea" NOT NULL,
	"type_denominator" "bytea" NOT NULL,
	"interaction_data" "bytea" NOT NULL,
	"signature" "bytea" NOT NULL,
	"tx_hash" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"endpoint" varchar NOT NULL,
	"key_p256dh" varchar NOT NULL,
	"key_auth" varchar NOT NULL,
	"expire_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_push_token" UNIQUE("wallet","endpoint","key_p256dh")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_oracle" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" "bytea" NOT NULL,
	"hook_signature_key" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"merkle_root" "bytea",
	"synced" boolean DEFAULT false,
	"last_sync_tx_hash" "bytea",
	CONSTRAINT "product_oracle_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
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
CREATE TABLE IF NOT EXISTS "product_oracle_purchase" (
	"id" serial PRIMARY KEY NOT NULL,
	"oracle_id" integer NOT NULL,
	"purchase_id" "bytea" NOT NULL,
	"external_id" varchar NOT NULL,
	"external_customer_id" varchar NOT NULL,
	"purchase_token" varchar,
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
 ALTER TABLE "product_oracle_purchase_item" ADD CONSTRAINT "product_oracle_purchase_item_purchase_id_product_oracle_purchase_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."product_oracle_purchase"("purchase_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_oracle_purchase" ADD CONSTRAINT "product_oracle_purchase_oracle_id_product_oracle_id_fk" FOREIGN KEY ("oracle_id") REFERENCES "public"."product_oracle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_interactions_purchase_map_idx" ON "interactions_purchase_tracker" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_pending_interactions_idx" ON "interactions_pending" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_idx" ON "interactions_pending" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_pushed_interactions_idx" ON "interactions_pushed" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_push_tokens_idx" ON "push_tokens" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unique_product_id" ON "product_oracle" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_purchase_id_idx" ON "product_oracle_purchase_item" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_external_id" ON "product_oracle_purchase" USING btree ("external_id","oracle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_id_idx" ON "product_oracle_purchase" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_listener_id" ON "product_oracle_purchase" USING btree ("external_id","purchase_token");