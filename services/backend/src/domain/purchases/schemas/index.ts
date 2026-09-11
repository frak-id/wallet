import { t } from "@backend-utils";
import type { Static } from "elysia";

export const WebhookPlatformSchema = t.Union([
    t.Literal("shopify"),
    t.Literal("woocommerce"),
    t.Literal("magento"),
    t.Literal("custom"),
    t.Literal("internal"),
]);
export type WebhookPlatform = Static<typeof WebhookPlatformSchema>;

export const PurchaseStatusSchema = t.Union([
    t.Literal("pending"),
    t.Literal("confirmed"),
    t.Literal("cancelled"),
    t.Literal("refunded"),
]);
export type PurchaseStatus = Static<typeof PurchaseStatusSchema>;
