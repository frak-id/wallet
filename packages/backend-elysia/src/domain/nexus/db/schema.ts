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

/**
 * Table storing the push tokens used for the notifications
 */
export const pushTokensTable = pgTable(
    "push_tokens",
    {
        id: serial("id").primaryKey(),
        wallet: customHex("wallet").notNull().$type<Address>(),
        endpoint: varchar("endpoint").notNull(),
        keyP256dh: varchar("key_p256dh").notNull(),
        keyAuth: varchar("key_auth").notNull(),
        expireAt: timestamp("expire_at"),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => ({
        walletIdx: index("wallet_push_tokens_idx").on(table.wallet),
        unqPushToken: unique("unique_push_token").on(
            table.wallet,
            table.endpoint,
            table.keyP256dh
        ),
    })
);

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
        uniqueInteractionPerStatus: unique("unique_interaction_per_status").on(
            table.wallet,
            table.productId,
            table.interactionData,
            table.status
        ),
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
