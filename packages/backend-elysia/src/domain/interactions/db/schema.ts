import { customHex } from "@backend-utils";
import {
    boolean,
    index,
    pgEnum,
    pgTable,
    serial,
    timestamp,
    unique,
    varchar,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";

export const interactionSimulationStatus = pgEnum(
    "interactions_simulation_status",
    ["pending", "no_session", "failed", "succeeded"]
);

/**
 * Table for all the pending interactions
 */
export const pendingInteractionsTable = pgTable(
    "interactions_pending",
    {
        id: serial("id").primaryKey(),
        wallet: customHex("wallet").notNull().$type<Address>(),
        productId: customHex("product_id").notNull(),
        typeDenominator: customHex("type_denominator").notNull(),
        interactionData: customHex("interaction_data").notNull(),
        signature: customHex("signature"),
        status: interactionSimulationStatus("simulation_status"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow(),
        locked: boolean("locked").default(false),
    },
    (table) => ({
        walletIdx: index("wallet_pending_interactions_idx").on(table.wallet),
        productIdx: index("product_idx").on(table.productId),
    })
);

/**
 * Table for all the pushed interactions
 */
export const pushedInteractionsTable = pgTable(
    "interactions_pushed",
    {
        id: serial("id").primaryKey(),
        wallet: customHex("wallet").notNull().$type<Address>(),
        productId: customHex("product_id").notNull(),
        typeDenominator: customHex("type_denominator").notNull(),
        interactionData: customHex("interaction_data").notNull(),
        signature: customHex("signature").notNull(),
        txHash: customHex("tx_hash").notNull(),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
        walletIdx: index("wallet_pushed_interactions_idx").on(table.wallet),
    })
);

/**
 * Table for all the pushed interactions
 */
export const interactionsPurchaseTrackerTable = pgTable(
    "interactions_purchase_tracker",
    {
        id: serial("id").primaryKey(),
        wallet: customHex("wallet").notNull().$type<Address>(),
        externalPurchaseId: varchar("external_purchase_id").notNull(),
        externalCustomerId: varchar("external_customer_id").notNull(),
        token: varchar("token").notNull(),
        pushed: boolean("pushed").default(false),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => ({
        walletIdx: index("wallet_interactions_purchase_map_idx").on(
            table.wallet
        ),
        uniqueMappingIdIdx: unique("unique_map_idx").on(
            table.externalPurchaseId,
            table.externalCustomerId
        ),
    })
);
