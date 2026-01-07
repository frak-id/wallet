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
import { customHex } from "../../../utils/drizzle/customTypes";

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
        productId: customHex("product_id").unique().notNull(),
        hookSignatureKey: varchar("hook_signature_key").notNull(),
        createdAt: timestamp("created_at").defaultNow(),
        platform: webhookPlatformEnum("platform").notNull().default("shopify"),
        // TODO: Phase 1 - Link to merchants table via merchantId
    },
    (table) => [index("merchant_webhooks_product_id_idx").on(table.productId)]
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
        webhookId: integer("webhook_id")
            .references(() => merchantWebhooksTable.id)
            .notNull(),
        externalId: varchar("external_id").notNull(),
        externalCustomerId: varchar("external_customer_id").notNull(),
        purchaseToken: varchar("purchase_token"),
        totalPrice: decimal("total_price").notNull(),
        currencyCode: varchar("currency_code", { length: 4 }).notNull(),
        status: purchaseStatusEnum("status"),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
        // TODO: Phase 2 - Add identityGroupId for identity linking
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
    ]
);

export const purchaseItemsTable = pgTable(
    "purchase_items",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        purchaseId: uuid("purchase_id")
            .references(() => purchasesTable.id)
            .notNull(),
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
