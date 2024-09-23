import {
    decimal,
    pgTable,
    serial,
    timestamp,
    unique,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { customHex } from "../../../common/drizzle/customTypes";

export const productOracle = pgTable(
    "product_purchase_oracle",
    {
        id: serial("id").primaryKey(),
        productId: customHex("product_id").notNull(),
        // The signing key that will be used for the hooks
        hookSignatureKey: varchar("hook_signature_key").notNull(),
        // Date infos
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => ({
        productIdIdx: uniqueIndex("unique_product_id").on(table.productId),
    })
);

export const purchaseStatus = pgTable(
    "product_purchase_status",
    {
        id: serial("id").primaryKey(),
        oracleId: serial("oracle_id").references(() => productOracle.id),
        // External id from the external app
        externalId: varchar("external_id").notNull(),
        // The total price of the order
        totalPrice: decimal("total_price").notNull(),
        // ISO 4217 currency code, so 3 char, we take 4 char to be safe
        currencyCode: varchar("currency_code", { length: 4 }).notNull(),
        // todo: What would be the form of the status??
        status: varchar("status").notNull(),
        // The computed leaf for this order, usefull for fastly rebuilding the merkle tree
        leaf: customHex("leaf").notNull(),
        // Update infos
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
        externalIdIdx: uniqueIndex("unique_external_id").on(
            table.externalId,
            table.oracleId
        ),
        unqStatus: unique("unique_status").on(table.status),
    })
);

// topics: orders/* (orders/paid orders/fulfilled orders/cancelled orders/create)
//
