import {
    boolean,
    index,
    integer,
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
    ["pending", "no_session", "failed", "succeeded", "execution_failed"]
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

        // Failure tracking
        failureReason: varchar("failure_reason", { length: 500 }),

        // Retry tracking
        retryCount: integer("retry_count").default(0).notNull(),
        lastRetryAt: timestamp("last_retry_at"),
        nextRetryAt: timestamp("next_retry_at"),

        // Timestamps
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow(),

        // Locking (null = unlocked, timestamp = locked)
        lockedAt: timestamp("locked_at"),
    },
    (table) => [
        index("wallet_pending_interactions_idx").on(table.wallet),
        index("product_idx").on(table.productId),
        index("status_idx").on(table.status),
        index("next_retry_idx").on(table.nextRetryAt),
        index("locked_at_idx").on(table.lockedAt),
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

export const archiveReasonEnum = pgEnum("interactions_archive_reason", [
    "max_retries",
    "expired",
    "manual",
]);

/**
 * Table for archived interactions that couldn't be processed
 */
export const archivedInteractionsTable = pgTable(
    "interactions_archived",
    {
        id: serial("id").primaryKey(),
        // Original interaction data
        wallet: customHex("wallet").notNull().$type<Address>(),
        productId: customHex("product_id").notNull(),
        typeDenominator: customHex("type_denominator").notNull(),
        interactionData: customHex("interaction_data").notNull(),
        signature: customHex("signature"),

        // Final status before archiving
        finalStatus: interactionSimulationStatus("final_status").notNull(),
        failureReason: varchar("failure_reason", { length: 500 }),

        // Retry history
        totalRetries: integer("total_retries").notNull(),

        // Archive metadata
        archiveReason: archiveReasonEnum("archive_reason").notNull(),
        archivedAt: timestamp("archived_at").defaultNow().notNull(),

        // Original timestamps
        originalCreatedAt: timestamp("original_created_at").notNull(),
    },
    (table) => [
        index("wallet_archived_interactions_idx").on(table.wallet),
        index("archived_at_idx").on(table.archivedAt),
        index("archive_reason_idx").on(table.archiveReason),
    ]
);
