DROP INDEX "monerium_connections_profile_sync_idx";--> statement-breakpoint
DROP INDEX "monerium_connections_link_sync_idx";--> statement-breakpoint
DROP INDEX "monerium_tracked_orders_sync_idx";--> statement-breakpoint
CREATE INDEX "monerium_connections_sync_idx" ON "monerium_connections" USING btree ("state_checked_at" NULLS FIRST) WHERE status = 'connected';--> statement-breakpoint
CREATE INDEX "monerium_tracked_orders_sync_idx" ON "monerium_tracked_orders" USING btree ("last_checked_at" NULLS FIRST) WHERE state in ('placed', 'pending');