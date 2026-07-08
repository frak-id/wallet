CREATE TABLE "billing_document_counters" (
	"merchant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "billing_document_counters_merchant_id_kind_year_pk" PRIMARY KEY("merchant_id","kind","year")
);
--> statement-breakpoint
CREATE TABLE "billing_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reference" text NOT NULL,
	"document_date" timestamp NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"currency" text NOT NULL,
	"gross_amount" numeric(36, 18),
	"net_amount" numeric(36, 18),
	"tx_hash" "bytea",
	"linked_deposit_id" uuid,
	"details" jsonb,
	"pdf_storage_key" text,
	"pdf_generated_at" timestamp,
	"created_by" "bytea",
	"voided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_documents_merchant_reference_uq" UNIQUE("merchant_id","reference")
);
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "accounting_info" jsonb;--> statement-breakpoint
CREATE INDEX "billing_documents_merchant_idx" ON "billing_documents" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "billing_documents_merchant_kind_idx" ON "billing_documents" USING btree ("merchant_id","kind");