CREATE TABLE "install_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(6) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"anonymous_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "install_codes_code_idx" ON "install_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "install_codes_merchant_anonymous_idx" ON "install_codes" USING btree ("merchant_id","anonymous_id");--> statement-breakpoint
CREATE INDEX "install_codes_expires_at_idx" ON "install_codes" USING btree ("expires_at");