CREATE TYPE "public"."frak_purchase_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."shopify_purchase_status" AS ENUM('pending', 'active', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopId" integer NOT NULL,
	"shop" text NOT NULL,
	"purchaseId" integer NOT NULL,
	"confirmationUrl" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text NOT NULL,
	"status" "shopify_purchase_status" NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"txHash" text,
	"txStatus" "frak_purchase_status",
	"bank" text NOT NULL
);
