ALTER TABLE "identity_nodes" ADD COLUMN "proof_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "install_codes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "device_pairing" DROP COLUMN "origin_node";