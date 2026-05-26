import { sql } from "drizzle-orm";
import {
    bigserial,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";

/**
 * Source of truth for the identity-node taxonomy. Defined here (next to the
 * column that consumes it) rather than in `../schemas/index.ts` so the
 * runtime Drizzle table can be imported from environments that don't pull
 * in the backend's TypeBox helpers (e.g. the bootstrap migration job).
 */
export type IdentityType = "anonymous_fingerprint" | "wallet" | "email";

export type PendingPurchaseValidation = {
    orderId: string;
    purchaseToken: string;
};

export type MergedGroup = {
    groupId: string;
    mergedAt: string;
};

export const identityGroupsTable = pgTable("identity_groups", {
    id: uuid("id").primaryKey().defaultRandom(),
    mergedGroups: jsonb("merged_groups").$type<MergedGroup[]>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const identityNodesTable = pgTable(
    "identity_nodes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        groupId: uuid("group_id").notNull(),
        identityType: text("identity_type").$type<IdentityType>().notNull(),
        identityValue: text("identity_value").notNull(),
        merchantId: uuid("merchant_id"),
        validationData:
            jsonb("validation_data").$type<PendingPurchaseValidation>(),
        createdAt: timestamp("created_at").defaultNow(),
        // Soft-unlink marker. Stamped on the loser wallet identity node
        // during a wallet merge so `getWalletForGroup` can deterministically
        // resolve to the winner while keeping the loser->group mapping
        // available for `findGroupByIdentity` (prevents stray references to
        // the loser wallet from accidentally creating a new identity group).
        unlinkedAt: timestamp("unlinked_at"),
    },
    (table) => [
        unique("identity_nodes_unique_identity")
            .on(table.identityType, table.identityValue, table.merchantId)
            .nullsNotDistinct(),
        index("identity_nodes_group_idx").on(table.groupId),
    ]
);

/**
 * Reason values written on a wallet binding row.
 *  - `initial`   — first binding when a credential is registered.
 *  - `merged`    — written by the wallet-merge flow when the previous active
 *                  binding for `(authenticator, chain)` gets repointed to a
 *                  winner wallet.
 *  - `recovery`  — reserved for the recovery flow refactor (Phase 3+); never
 *                  written by Phase 1 code paths.
 */
export type BindingReason = "initial" | "merged" | "recovery";

/**
 * Mapping of WebAuthn credential → smart-account address, per chain,
 * per environment (postgres is schema-per-env).
 *
 *  - One ACTIVE row per `(authenticator_id, chain_id)` enforced by a partial
 *    unique index (`unlinked_at IS NULL`).
 *  - History is preserved on every mutation: the previous row gets stamped
 *    with `unlinked_at = now()` and a new row is inserted with the incoming
 *    binding. Useful audit trail for merges and recoveries.
 *  - `authenticator_id` is a text reference to the libSQL `authenticators`
 *    table's credential id. No FK across databases.
 *  - Lives in postgres (env-scoped) rather than libSQL (env-shared) so a
 *    merge performed on one environment can never leak the repointed binding
 *    into another environment that runs on the same chain.
 */
export const authenticatorWalletBindingsTable = pgTable(
    "authenticator_wallet_bindings",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        authenticatorId: text("authenticator_id").notNull(),
        chainId: integer("chain_id").notNull(),
        smartWalletAddress: customHex("smart_wallet_address")
            .$type<Address>()
            .notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        unlinkedAt: timestamp("unlinked_at"),
        reason: text("reason").$type<BindingReason>().notNull(),
    },
    (table) => [
        uniqueIndex("awb_active_idx")
            .on(table.authenticatorId, table.chainId)
            .where(sql`unlinked_at IS NULL`),
        index("awb_wallet_chain_idx")
            .on(table.smartWalletAddress, table.chainId)
            .where(sql`unlinked_at IS NULL`),
    ]
);

export type AuthenticatorWalletBindingSelect =
    typeof authenticatorWalletBindingsTable.$inferSelect;

export const installCodesTable = pgTable(
    "install_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        code: varchar("code", { length: 6 }).notNull(),
        merchantId: uuid("merchant_id").notNull(),
        anonymousId: text("anonymous_id").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
    },
    (table) => [
        uniqueIndex("install_codes_code_idx").on(table.code),
        index("install_codes_merchant_anonymous_idx").on(
            table.merchantId,
            table.anonymousId
        ),
        index("install_codes_expires_at_idx").on(table.expiresAt),
    ]
);
