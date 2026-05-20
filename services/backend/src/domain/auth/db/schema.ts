import { sql } from "drizzle-orm";
import {
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { Address } from "viem";

/**
 * Reason values written on a binding row. The `recovery` value is reserved
 * for the recovery flow refactor (Phase 3+) and is never written by Phase 1
 * code paths.
 */
export type BindingReason = "initial" | "merged" | "recovery";

/**
 * Authenticator credentials table for WebAuthn
 *  - Stored in sqld (libSQL) instead of MongoDB
 *  - Append-only at the credential level: a row is inserted once at register
 *    and never updated or deleted afterwards.
 *  - Shared across all environments (origin-bound WebAuthn credentials).
 *
 * Note on `smart_wallet_address`:
 *  - Authoritative source of truth is `authenticator_wallet_bindings` below
 *    (chain-scoped). The column on this table is the legacy denormalised
 *    value kept for backwards-compatible reads and only updated through
 *    `repointBinding` for consistency.
 *
 * Note on `email`:
 *  - Authoritative source of truth is the postgres `identity_nodes` row
 *    of type `email` attached to the wallet's identity group. Reads go
 *    through `IdentityRepository.findEmailForGroup`.
 *  - The column on this table is only read by the bootstrap back-fill to
 *    migrate legacy values into `identity_nodes`. Once every environment
 *    has run the back-fill cleanly the column + its index get dropped in
 *    a follow-up PR.
 */
export const authenticatorsTable = sqliteTable(
    "authenticators",
    {
        id: text("id").primaryKey(),
        smartWalletAddress: text("smart_wallet_address"),
        userAgent: text("user_agent").notNull(),
        publicKeyX: text("public_key_x").notNull(),
        publicKeyY: text("public_key_y").notNull(),
        credentialPublicKey: text("credential_public_key").notNull(),
        counter: integer("counter").notNull(),
        credentialDeviceType: text("credential_device_type").notNull(),
        credentialBackedUp: integer("credential_backed_up", {
            mode: "boolean",
        }).notNull(),
        transports: text("transports", { mode: "json" }).$type<string[]>(),
        // Legacy email column. Authoritative source is the postgres
        // `identity_nodes` row of type `email` attached to the wallet's
        // identity group. This column is read once per row by the bootstrap
        // back-fill (`runAuthBindingBackfill`) and is otherwise dead weight;
        // drop in a follow-up PR once every env has migrated cleanly.
        email: text("email"),
    },
    // Case-insensitive expression index used by the back-fill job to look up
    // legacy email rows in bulk. Dropped alongside the column once the
    // identity-node migration has fully rolled out.
    (table) => [
        index("authenticators_email_lower_idx").on(sql`LOWER(${table.email})`),
    ]
);

/**
 * Mapping of WebAuthn credential → smart-account address, per chain.
 *
 *  - One ACTIVE row per `(authenticator_id, chain_id)` enforced by a partial
 *    unique index (`unlinked_at IS NULL`).
 *  - History is preserved on every mutation: the previous row gets stamped
 *    with `unlinked_at = unixepoch()` and a new row is inserted with the
 *    incoming binding. Useful audit trail for merges and recoveries.
 *  - `recovery_blob` is declared but unused in Phase 1; it will hold the
 *    encrypted recovery material when the recovery flow lands on this table.
 */
export const authenticatorWalletBindingsTable = sqliteTable(
    "authenticator_wallet_bindings",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        authenticatorId: text("authenticator_id")
            .notNull()
            .references(() => authenticatorsTable.id),
        chainId: integer("chain_id").notNull(),
        smartWalletAddress: text("smart_wallet_address")
            .notNull()
            .$type<Address>(),
        recoveryBlob: text("recovery_blob"),
        createdAt: integer("created_at").notNull(),
        unlinkedAt: integer("unlinked_at"),
        reason: text("reason").notNull().$type<BindingReason>(),
    },
    (table) => [
        // Partial unique index — one ACTIVE binding per (authenticator, chain).
        // Doubles as the leading-column index for `getActiveBindings(credentialId)`.
        uniqueIndex("awb_active_idx")
            .on(table.authenticatorId, table.chainId)
            .where(sql`"unlinked_at" IS NULL`),
        // Fast "which credential currently binds to this wallet on this chain".
        index("awb_wallet_chain_idx")
            .on(table.smartWalletAddress, table.chainId)
            .where(sql`"unlinked_at" IS NULL`),
    ]
);

export type AuthenticatorBindingSelect =
    typeof authenticatorWalletBindingsTable.$inferSelect;
