import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
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
        bankAddress: customHex("bank_address").$type<Address>(),
        webhookSignatureKey: text("webhook_signature_key"),
        webhookPlatform: text("webhook_platform"),
        config: jsonb("config").$type<MerchantConfig>(),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
        index("merchants_product_id_idx").on(table.productId),
        index("merchants_domain_idx").on(table.domain),
    ]
);
