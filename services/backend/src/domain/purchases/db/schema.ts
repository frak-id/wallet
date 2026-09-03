import {
    decimal,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import type { PurchaseStatus, WebhookPlatform } from "../schemas";

export const merchantWebhooksTable = pgTable(
    "merchant_webhooks",
    {
        id: serial("id").primaryKey(),
        merchantId: uuid("merchant_id").notNull(),
        hookSignatureKey: varchar("hook_signature_key").notNull(),
        createdAt: timestamp("created_at").defaultNow(),
        platform: text("platform")
            .$type<WebhookPlatform>()
            .notNull()
            .default("shopify"),
    },
    (table) => [
        uniqueIndex("merchant_webhooks_merchant_id_idx").on(table.merchantId),
    ]
);

export const purchasesTable = pgTable(
    "purchases",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        webhookId: integer("webhook_id").notNull(),
        externalId: varchar("external_id").notNull(),
        externalCustomerId: varchar("external_customer_id").notNull(),
        purchaseToken: varchar("purchase_token"),
        totalPrice: decimal("total_price").notNull(),
        currencyCode: varchar("currency_code", { length: 4 }).notNull(),
        status: text("status").$type<PurchaseStatus>(),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
        identityGroupId: uuid("identity_group_id"),
    },
    (table) => [
        uniqueIndex("purchases_external_id_webhook_idx").on(
            table.externalId,
            table.webhookId
        ),
        uniqueIndex("purchases_external_listener_idx").on(
            table.externalId,
            table.purchaseToken
        ),
        index("purchases_identity_group_idx").on(table.identityGroupId),
    ]
);

export const purchaseItemsTable = pgTable(
    "purchase_items",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        purchaseId: uuid("purchase_id").notNull(),
        externalId: varchar("external_id").notNull(),
        price: decimal("price").notNull(),
        // Amount actually paid for the line: post-discount, tax-inclusive,
        // shipping excluded. Nullable for rows written before it existed.
        totalPrice: decimal("total_price"),
        name: varchar("name").notNull(),
        title: varchar("title").notNull(),
        imageUrl: varchar("image_url"),
        quantity: integer("quantity").notNull(),
        // Nullable: not every provider sends a SKU.
        sku: varchar("sku"),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        index("purchase_items_purchase_id_idx").on(table.purchaseId),
        // `external_id` is the parent product id, so it repeats across the
        // variants of one product; the sku is what separates them.
        // `nullsNotDistinct` so a redelivery cannot duplicate a sku-less line.
        unique("purchase_items_line_idx")
            .on(table.purchaseId, table.externalId, table.sku)
            .nullsNotDistinct(),
    ]
);

/**
 * Purchase claims table - tracks SDK claims awaiting webhook validation.
 *
 * Bidirectional flow — interaction is only created when both claim and webhook are present:
 *
 * Path A (claim first):
 * 1. SDK calls /track/purchase → creates claim with (order_id, token)
 * 2. Webhook arrives → finds claim → resolves identity → creates interaction → deletes claim
 *
 * Path B (webhook first):
 * 1. Webhook arrives → no claim found → stores purchase without interaction (pending claim)
 * 2. SDK calls /track/purchase → finds stored purchase → reconciles identity → creates interaction
 *
 * Purchases without a claim will have no interaction (no claim = no interaction).
 * These are identifiable in the DB as purchases with a NULL identity_group_id.
 *
 * Security: Claims are keyed by (merchant_id, order_id, token) - attackers can't guess order_id + token
 */
export const purchaseClaimsTable = pgTable(
    "purchase_claims",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        customerId: varchar("customer_id").notNull(),
        orderId: varchar("order_id").notNull(),
        purchaseToken: varchar("purchase_token").notNull(),
        claimingIdentityGroupId: uuid("claiming_identity_group_id").notNull(),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        uniqueIndex("purchase_claims_unique_purchase").on(
            table.merchantId,
            table.orderId,
            table.purchaseToken
        ),
        index("purchase_claims_identity_group_idx").on(
            table.claimingIdentityGroupId
        ),
        index("purchase_claims_merchant_token_idx").on(
            table.merchantId,
            table.purchaseToken
        ),
    ]
);

export type PurchaseSelect = typeof purchasesTable.$inferSelect;
export type PurchaseInsert = Omit<typeof purchasesTable.$inferInsert, "id">;
export type PurchaseItemInsert = Omit<
    typeof purchaseItemsTable.$inferInsert,
    "id" | "purchaseId"
>;
export type PurchaseItemSelect = typeof purchaseItemsTable.$inferSelect;
export type MerchantWebhook = typeof merchantWebhooksTable.$inferSelect;
