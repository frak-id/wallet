ALTER TABLE "session" ADD COLUMN "refreshToken" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "refreshTokenExpires" timestamp;