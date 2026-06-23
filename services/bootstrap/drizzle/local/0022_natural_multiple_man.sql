ALTER TABLE "device_pairing" ADD COLUMN "authenticator_id" varchar;--> statement-breakpoint
ALTER TABLE "device_pairing" ADD COLUMN "authenticator_hint" varchar;--> statement-breakpoint
CREATE UNIQUE INDEX "pairing_pending_hint_idx" ON "device_pairing" USING btree ("authenticator_hint") WHERE "device_pairing"."authenticator_hint" IS NOT NULL AND "device_pairing"."resolved_at" IS NULL;