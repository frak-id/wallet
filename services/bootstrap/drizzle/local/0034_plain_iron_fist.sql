ALTER TABLE "billing_documents" DROP CONSTRAINT "billing_documents_merchant_reference_uq";--> statement-breakpoint
ALTER TABLE "billing_document_counters" DROP CONSTRAINT "billing_document_counters_merchant_id_kind_year_pk";--> statement-breakpoint
ALTER TABLE "billing_document_counters" ADD CONSTRAINT "billing_document_counters_kind_year_pk" PRIMARY KEY("kind","year");--> statement-breakpoint
ALTER TABLE "billing_document_counters" DROP COLUMN "merchant_id";--> statement-breakpoint
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_reference_uq" UNIQUE("reference");