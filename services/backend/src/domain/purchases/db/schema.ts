import {
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

export const webhookPlatformEnum = pgEnum("webhook_platform", [
    "shopify",
    "woocommerce",
    "custom",
    "internal",
]);

export const merchantWebhooksTable = pgTable(
    "merchant_webhooks",
    {
        id: serial("id").primaryKey(),
        merchantId: uuid("merchant_id").notNull(),
        hookSignatureKey: varchar("hook_signature_key").notNull(),
        createdAt: timestamp("created_at").defaultNow(),
        platform: webhookPlatformEnum("platform").notNull().default("shopify"),
    },
    (table) => [index("merchant_webhooks_merchant_id_idx").on(table.merchantId)]
);

export const purchaseStatusEnum = pgEnum("purchase_status", [
    "pending",
    "confirmed",
    "cancelled",
    "refunded",
]);

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
        status: purchaseStatusEnum("status"),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
        identityGroupId: uuid("identity_group_id"),
        // TODO: Phase 3 - Add touchpointId for attribution
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
        index("purchases_webhook_id_idx").on(table.webhookId),
    ]
);

export const purchaseItemsTable = pgTable(
    "purchase_items",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        purchaseId: uuid("purchase_id").notNull(),
        externalId: varchar("external_id").notNull(),
        price: decimal("price").notNull(),
        name: varchar("name").notNull(),
        title: varchar("title").notNull(),
        imageUrl: varchar("image_url"),
        quantity: integer("quantity").notNull(),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        index("purchase_items_purchase_id_idx").on(table.purchaseId),
        uniqueIndex("purchase_items_external_id_idx").on(
            table.externalId,
            table.purchaseId
        ),
    ]
);

/**
 * Purchase claims table - tracks SDK claims awaiting webhook validation.
 *
 * Flow:
 * 1. SDK calls /track/purchase → creates claim with (order_id, token) → claiming_identity_group_id
 * 2. Webhook arrives → looks up claim by (merchant_id, order_id, token)
 *    - If found: validates claim, links purchase to claiming group, deletes claim
 *    - If not found: resolves merchant_customer directly (returning user or no SDK)
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
        // Only one claim per purchase (prevents race conditions)
        uniqueIndex("purchase_claims_unique_purchase").on(
            table.merchantId,
            table.orderId,
            table.purchaseToken
        ),
        index("purchase_claims_identity_group_idx").on(
            table.claimingIdentityGroupId
        ),
        index("purchase_claims_merchant_idx").on(table.merchantId),
    ]
);
