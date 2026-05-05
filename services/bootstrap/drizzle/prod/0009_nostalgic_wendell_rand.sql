ALTER TABLE "push_tokens" DROP CONSTRAINT "unique_push_token";--> statement-breakpoint
ALTER TABLE "push_tokens" ALTER COLUMN "key_p256dh" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "push_tokens" ALTER COLUMN "key_auth" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD COLUMN "type" varchar(16) DEFAULT 'web-push' NOT NULL;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "unique_push_token" UNIQUE("wallet","type","endpoint");