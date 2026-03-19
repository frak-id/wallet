CREATE TABLE "notification_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_sent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet" "bytea" NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"payload" jsonb NOT NULL,
	"broadcast_id" uuid,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"opened_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "notification_broadcasts_merchant_idx" ON "notification_broadcasts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "notification_broadcasts_created_at_idx" ON "notification_broadcasts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_sent_wallet_idx" ON "notification_sent" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "notification_sent_type_idx" ON "notification_sent" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notification_sent_broadcast_idx" ON "notification_sent" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "notification_sent_sent_at_idx" ON "notification_sent" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "notification_sent_wallet_sent_at_idx" ON "notification_sent" USING btree ("wallet","sent_at");