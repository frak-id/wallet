import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Webhook platform schema - supported platforms for merchant webhooks
 */
export const WebhookPlatformSchema = t.Union([
    t.Literal("shopify"),
    t.Literal("woocommerce"),
    t.Literal("magento"),
    t.Literal("custom"),
    t.Literal("internal"),
]);
export type WebhookPlatform = Static<typeof WebhookPlatformSchema>;

/**
 * Purchase status schema - lifecycle states for purchases
 */
export const PurchaseStatusSchema = t.Union([
    t.Literal("pending"),
    t.Literal("confirmed"),
    t.Literal("cancelled"),
    t.Literal("refunded"),
]);
export type PurchaseStatus = Static<typeof PurchaseStatusSchema>;
