import type {
    MoneriumOrderState,
    MoneriumProfileKind,
    MoneriumProfileState,
} from "@frak-labs/app-essentials/monerium";
import { sql } from "drizzle-orm";
import {
    boolean,
    index,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";
import type {
    MoneriumConnectionState,
    MoneriumWalletLinkState,
} from "../schemas";

type MoneriumConnectionStatus = Exclude<MoneriumConnectionState, "none">;
export type MoneriumAuthMethod = "oauth" | "siwe";

/** One Monerium connection per smart-account address. Token columns hold AES-256-GCM blobs. */
export const moneriumConnectionsTable = pgTable(
    "monerium_connections",
    {
        wallet: customHex("wallet").primaryKey().$type<Address>(),
        moneriumUserId: varchar("monerium_user_id"),
        profileId: varchar("profile_id"),
        profileKind: varchar("profile_kind", {
            length: 16,
        }).$type<MoneriumProfileKind>(),
        profileState: varchar("profile_state", {
            length: 16,
        }).$type<MoneriumProfileState>(),
        profileReasonCode: varchar("profile_reason_code"),
        walletLinkState: varchar("wallet_link_state", { length: 16 })
            .notNull()
            .default("none")
            .$type<MoneriumWalletLinkState>(),
        status: varchar("status", { length: 24 })
            .notNull()
            .default("connected")
            .$type<MoneriumConnectionStatus>(),
        accessTokenEncrypted: text("access_token_encrypted"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenEncrypted: text("refresh_token_encrypted"),
        walletLinkPendingAt: timestamp("wallet_link_pending_at"),
        profileStateChangedAt: timestamp("profile_state_changed_at"),
        siweFailedAt: timestamp("siwe_failed_at"),
        stateCheckedAt: timestamp("state_checked_at"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        // Serves both sync claims: they filter on `status` and sort never-checked first.
        index("monerium_connections_sync_idx")
            .on(table.stateCheckedAt.asc().nullsFirst())
            .where(sql`status = 'connected'`),
    ]
);

/** Single-use OAuth/SIWE handshakes, bound to the session wallet. OAuth lives 30 minutes, SIWE as long as its message (10). */
export const moneriumPendingAuthsTable = pgTable(
    "monerium_pending_auths",
    {
        state: varchar("state").primaryKey(),
        wallet: customHex("wallet").notNull().$type<Address>(),
        method: varchar("method", { length: 8 })
            .notNull()
            .$type<MoneriumAuthMethod>(),
        codeVerifierEncrypted: text("code_verifier_encrypted").notNull(),
        siweMessage: text("siwe_message"),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("monerium_pending_auths_wallet_idx").on(table.wallet),
        index("monerium_pending_auths_expires_at_idx").on(table.expiresAt),
    ]
);

/** Orders in flight for the sync job. No IBAN, name or memo is ever stored. */
export const moneriumTrackedOrdersTable = pgTable(
    "monerium_tracked_orders",
    {
        id: uuid("id").primaryKey(),
        wallet: customHex("wallet").notNull().$type<Address>(),
        amount: varchar("amount", { length: 32 }).notNull(),
        state: varchar("state", { length: 16 })
            .notNull()
            .$type<MoneriumOrderState>(),
        placementAccepted: boolean("placement_accepted")
            .notNull()
            .default(false),
        lastCheckedAt: timestamp("last_checked_at"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("monerium_tracked_orders_wallet_idx").on(table.wallet),
        index("monerium_tracked_orders_sync_idx")
            .on(table.lastCheckedAt.asc().nullsFirst())
            .where(sql`state in ('placed', 'pending')`),
    ]
);

export type MoneriumConnectionRow =
    typeof moneriumConnectionsTable.$inferSelect;
export type MoneriumPendingAuthRow =
    typeof moneriumPendingAuthsTable.$inferSelect;
export type MoneriumTrackedOrderRow =
    typeof moneriumTrackedOrdersTable.$inferSelect;
