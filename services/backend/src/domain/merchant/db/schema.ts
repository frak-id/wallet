import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";

export type MerchantConfig = {
    sdkConfig?: Record<string, unknown>;
    appearance?: Record<string, unknown>;
};

export const merchantsTable = pgTable(
    "merchants",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        productId: customHex("product_id").unique(),
        domain: text("domain").unique().notNull(),
        name: text("name").notNull(),
        ownerWallet: customHex("owner_wallet").$type<Address>().notNull(),
        bankAddress: customHex("bank_address").$type<Address>(),
        webhookSignatureKey: text("webhook_signature_key"),
        webhookPlatform: text("webhook_platform"),
        config: jsonb("config").$type<MerchantConfig>(),
        verifiedAt: timestamp("verified_at"),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
        index("merchants_product_id_idx").on(table.productId),
        index("merchants_domain_idx").on(table.domain),
        index("merchants_owner_wallet_idx").on(table.ownerWallet),
    ]
);

export const merchantAdminsTable = pgTable(
    "merchant_admins",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        wallet: customHex("wallet").$type<Address>().notNull(),
        addedBy: customHex("added_by").$type<Address>().notNull(),
        addedAt: timestamp("added_at").defaultNow().notNull(),
    },
    (table) => [
        index("merchant_admins_merchant_idx").on(table.merchantId),
        index("merchant_admins_wallet_idx").on(table.wallet),
        unique("merchant_admins_unique").on(table.merchantId, table.wallet),
    ]
);

export const merchantOwnershipTransfersTable = pgTable(
    "merchant_ownership_transfers",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id")
            .references(() => merchantsTable.id, { onDelete: "cascade" })
            .notNull()
            .unique(),
        fromWallet: customHex("from_wallet").$type<Address>().notNull(),
        toWallet: customHex("to_wallet").$type<Address>().notNull(),
        initiatedAt: timestamp("initiated_at").defaultNow().notNull(),
        expiresAt: timestamp("expires_at").notNull(),
    },
    (table) => [
        index("merchant_ownership_transfers_to_wallet_idx").on(table.toWallet),
    ]
);
