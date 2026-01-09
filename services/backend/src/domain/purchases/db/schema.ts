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
import { identityGroupsTable } from "../../identity/db/schema";
import { merchantsTable } from "../../merchant/db/schema";

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
        merchantId: uuid("merchant_id")
            .references(() => merchantsTable.id)
            .notNull(),
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
        identityGroupId: uuid("identity_group_id").references(
            () => identityGroupsTable.id,
            { onDelete: "set null" }
        ),
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
