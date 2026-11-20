import { t } from "@backend-utils";
import type { Static } from "elysia";

/** Body apps/shopify signs and posts when a one-time app purchase (bank top-up) goes active. */
export const ShopifyPaidPurchaseSchema = t.Object(
    {
        purchaseId: t.Number(),
        /** `*.myshopify.com` domain of the shop. */
        shop: t.String(),
        /** Shop domain stored on the purchase row (primary domain when set). */
        domain: t.String(),
        amount: t.String(),
        currency: t.String(),
        bank: t.String(),
        paidAt: t.String(),
        test: t.Boolean(),
        shopName: t.Optional(t.Nullable(t.String())),
        email: t.Optional(t.Nullable(t.String())),
    },
    // A Shopify app deployed ahead of the backend may send a field this one does not know yet.
    { additionalProperties: true }
);
export type ShopifyPaidPurchase = Static<typeof ShopifyPaidPurchaseSchema>;
