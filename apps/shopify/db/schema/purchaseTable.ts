import {
    bigint,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";

export const shopifyStatus = pgEnum("shopify_purchase_status", [
    "pending",
    "active",
    "declined",
    "expired",
]);
export const frakTxStatus = pgEnum("frak_purchase_status", [
    "pending",
    "confirmed",
]);

export const purchaseTable = pgTable("purchase", {
    id: serial("id").primaryKey(),
    // Shop info
    shopId: bigint("shopId", { mode: "number" }).notNull(),
    shop: text("shop").notNull(),
    // Purchase info
    purchaseId: bigint("purchaseId", { mode: "number" }).notNull(),
    confirmationUrl: text("confirmationUrl").notNull(),
    amount: text("amount").notNull(),
    currency: text("currency").notNull(),
    status: shopifyStatus("status").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
    // Frak side
    txHash: text("txHash"),
    txStatus: frakTxStatus("txStatus"),
    bank: text("bank").notNull(),
});

export type PurchaseTable = typeof purchaseTable;
