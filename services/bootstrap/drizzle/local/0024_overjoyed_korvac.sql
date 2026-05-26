DROP INDEX "pairing_pending_hint_idx";--> statement-breakpoint
ALTER TABLE "device_pairing" ADD COLUMN "authenticator_hints" varchar[];--> statement-breakpoint
ALTER TABLE "device_pairing" DROP COLUMN "authenticator_hint";