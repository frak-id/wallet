DROP INDEX "referral_links_merchant_idx";--> statement-breakpoint
DROP INDEX "touchpoints_identity_group_idx";--> statement-breakpoint
DROP INDEX "touchpoints_merchant_idx";--> statement-breakpoint
DROP INDEX "campaign_rules_merchant_idx";--> statement-breakpoint
DROP INDEX "campaign_rules_priority_idx";--> statement-breakpoint
DROP INDEX "identity_nodes_type_value_idx";--> statement-breakpoint
DROP INDEX "identity_nodes_merchant_idx";--> statement-breakpoint
DROP INDEX "merchant_admins_merchant_idx";--> statement-breakpoint
DROP INDEX "merchant_ownership_transfers_to_wallet_idx";--> statement-breakpoint
DROP INDEX "merchants_product_id_idx";--> statement-breakpoint
DROP INDEX "merchants_domain_idx";--> statement-breakpoint
DROP INDEX "notification_sent_wallet_idx";--> statement-breakpoint
DROP INDEX "notification_sent_type_idx";--> statement-breakpoint
DROP INDEX "notification_sent_broadcast_idx";--> statement-breakpoint
DROP INDEX "notification_sent_sent_at_idx";--> statement-breakpoint
DROP INDEX "purchase_claims_merchant_idx";--> statement-breakpoint
DROP INDEX "purchases_webhook_id_idx";--> statement-breakpoint
DROP INDEX "asset_logs_status_idx";--> statement-breakpoint
DROP INDEX "asset_logs_status_merchant_idx";--> statement-breakpoint
DROP INDEX "asset_logs_recipient_wallet_idx";--> statement-breakpoint
DROP INDEX "interaction_logs_type_idx";--> statement-breakpoint
DROP INDEX "interaction_logs_processed_at_idx";--> statement-breakpoint
CREATE INDEX "asset_logs_pending_expirable_idx" ON "asset_logs" USING btree ("expires_at") WHERE "status" = 'pending' AND "expires_at" IS NOT NULL AND "campaign_rule_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "asset_logs_processing_status_changed_idx" ON "asset_logs" USING btree ("status_changed_at") WHERE "status" = 'processing';--> statement-breakpoint
CREATE INDEX "interaction_logs_unprocessed_idx" ON "interaction_logs" USING btree ("created_at") WHERE "processed_at" IS NULL AND "identity_group_id" IS NOT NULL;