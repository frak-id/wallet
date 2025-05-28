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
import { customHex } from "../../../utils/drizzle/customTypes";

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
    (table) => [
        index("wallet_pending_interactions_idx").on(table.wallet),
        index("product_idx").on(table.productId),
    ]
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
    (table) => [index("wallet_pushed_interactions_idx").on(table.wallet)]
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
    (table) => [
        index("wallet_interactions_purchase_map_idx").on(table.wallet),
        unique("unique_map_idx").on(
            table.externalPurchaseId,
            table.externalCustomerId
        ),
    ]
);

export const backendTrackerSourceEnum = pgEnum(
    "backend_interactions_tracker_source",
    ["custom"]
);

/**
 * Table for all the backend interaction tracker
 */
export const backendTrackerTable = pgTable(
    "backend_interactions_tracker",
    {
        id: serial("id").primaryKey(),
        productId: customHex("product_id").unique().notNull(),
        // The signing key that will be used for the hooks
        hookSignatureKey: varchar("hook_signature_key").notNull(),
        // Date infos
        createdAt: timestamp("created_at").defaultNow(),
        // The source of this backend tracker
        source: backendTrackerSourceEnum("source").notNull().default("custom"),
    },
    (table) => [index("unique_tracker_product_id").on(table.productId)]
);
