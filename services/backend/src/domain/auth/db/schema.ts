import { sql } from "drizzle-orm";
import {
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Authenticator credentials table for WebAuthn
 *  - Stored in sqld (libSQL) instead of MongoDB
 *  - Append-only at the credential level: a row is inserted once at register
 *    and never updated or deleted afterwards.
 *  - Shared across all environments (origin-bound WebAuthn credentials)
 *
 * Note on `smart_wallet_address` / `email`:
 *  - Authoritative source of truth is `authenticator_wallet_bindings` below.
 *  - These columns are KEPT during the dual-write window for backwards
 *    compatibility; readers should prefer the bindings table and fall back
 *    here only if no active binding exists yet (legacy rows pre back-fill).
 *  - They are dropped in a follow-up PR once every consumer reads from the
 *    bindings table.
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
        // Legacy email column kept during dual-write. Authoritative source is
        // `authenticator_wallet_bindings.email`.
        email: text("email"),
    },
    // Case-insensitive expression index — matches the `LOWER(email) = ?`
    // legacy lookup performed by `AuthenticatorRepository.findByEmail`.
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
 *  - `email` is denormalised across a credential's active bindings (the same
 *    value on every chain). Reads can target any active binding.
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
        smartWalletAddress: text("smart_wallet_address").notNull(),
        email: text("email"),
        recoveryBlob: text("recovery_blob"),
        createdAt: integer("created_at").notNull(),
        unlinkedAt: integer("unlinked_at"),
        reason: text("reason").notNull(),
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
        // Case-insensitive email lookup scoped to active bindings, per chain.
        index("awb_email_lower_chain_idx")
            .on(sql`LOWER(${table.email})`, table.chainId)
            .where(sql`"unlinked_at" IS NULL AND "email" IS NOT NULL`),
    ]
);
