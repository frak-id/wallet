import {
    boolean,
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
import { customHex } from "../../../utils/drizzle/customTypes";

export const productOracleTable = pgTable(
    "product_oracle",
    {
        id: serial("id").primaryKey(),
        productId: customHex("product_id").unique().notNull(),
        // The signing key that will be used for the hooks
        hookSignatureKey: varchar("hook_signature_key").notNull(),
        // Date infos
        createdAt: timestamp("created_at").defaultNow(),
        // The current merkle root for this oracle
        merkleRoot: customHex("merkle_root"),
        // If the oracle is synced with the blockchain
        synced: boolean("synced").default(false),
        lastSyncTxHash: customHex("last_sync_tx_hash"),
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
        oracleId: integer("oracle_id")
            .references(() => productOracleTable.id)
            .notNull(),
        // The encoded purchase id for this purchase
        purchaseId: customHex("purchase_id").unique().notNull(),
        // External id from the external app
        externalId: varchar("external_id").notNull(),
        // External customer id from the external app
        externalCustomerId: varchar("external_customer_id").notNull(),
        // A custom purchase token
        purchaseToken: varchar("purchase_token"),
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
        externalListenerIdx: uniqueIndex("external_listener_id").on(
            table.externalId,
            table.purchaseToken
        ),
    })
);

export const purchaseItemTable = pgTable(
    "product_oracle_purchase_item",
    {
        id: serial("id").primaryKey(),
        purchaseId: customHex("purchase_id")
            .references(() => purchaseStatusTable.purchaseId)
            .notNull(),
        // The external item id
        externalId: varchar("external_id").notNull(),
        // The price of the product
        price: decimal("price").notNull(),
        // The name of the product
        name: varchar("name").notNull(),
        // The title of the product
        title: varchar("title").notNull(),
        // The quantity of the product
        quantity: integer("quantity").notNull(),
        // Update infos
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => ({
        purchaseIdIdx: index("item_purchase_id_idx").on(table.purchaseId),
    })
);
