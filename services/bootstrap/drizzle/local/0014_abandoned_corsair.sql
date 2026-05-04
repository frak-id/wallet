CREATE TABLE "merchant_explorer_ranking" (
	"merchant_id" uuid PRIMARY KEY NOT NULL,
	"manual_boost" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
