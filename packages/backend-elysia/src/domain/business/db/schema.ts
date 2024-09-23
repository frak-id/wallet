import {
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { customHex } from "../../../common/drizzle/customTypes";

export const productOracleTable = pgTable(
    "product_oracle",
    {
        id: serial("id").primaryKey(),
        productId: customHex("product_id").unique().notNull(),
        // The signing key that will be used for the hooks
        hookSignatureKey: varchar("hook_signature_key").notNull(),
        // Date infos
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => ({
        productIdIdx: index("unique_product_id").on(table.productId),
    })
);

export const purchaseStatusEnum = pgEnum("purchase_status", [
    "pending",
    "confirmed",
    "cancelled",
    "refunded",
]);

export const purchaseStatusTable = pgTable(
    "product_oracle_purchase",
    {
        id: serial("id").primaryKey(),
        oracleId: integer("oracle_id").references(() => productOracleTable.id),
        // The encoded purchase id for this purchase
        purchaseId: customHex("purchase_id").unique().notNull(),
        // External id from the external app
        externalId: varchar("external_id").notNull(),
        // The total price of the order
        totalPrice: decimal("total_price").notNull(),
        // ISO 4217 currency code, so 3 char, we take 4 char to be safe
        currencyCode: varchar("currency_code", { length: 4 }).notNull(),
        // Status, can be "pending", "confirmed", "cancelled" or "refunded"
        status: purchaseStatusEnum("status"),
        // The computed leaf for this order, usefull for fastly rebuilding the merkle tree (order_id + status)
        leaf: customHex("leaf"),
        // Update infos
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
        externalIdIdx: uniqueIndex("unique_external_id").on(
            table.externalId,
            table.oracleId
        ),
        purchaseIdIdx: index("purchase_id_idx").on(table.purchaseId),
    })
);
