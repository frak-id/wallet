import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Authenticator credentials table for WebAuthn
 *  - Stored in sqld (libSQL) instead of MongoDB.
 *  - Append-only at the credential level: a row is inserted once at register
 *    and never updated or deleted afterwards.
 *  - Shared across all environments (origin-bound WebAuthn credentials).
 *
 * Note on `smart_wallet_address` and `email`:
 *  - Both columns are LEGACY. The authoritative sources of truth post-refactor
 *    are the postgres `authenticator_wallet_bindings` row (chain-scoped,
 *    env-scoped) and the postgres `identity_nodes` row of type `email`
 *    (attached to the wallet's identity group).
 *  - The columns are kept here because production data still lives in them.
 *    They are read once per row by the bootstrap back-fill to populate the
 *    postgres tables on each environment, and otherwise behave as dead
 *    weight. They get dropped in a follow-up PR once every env has migrated
 *    cleanly.
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
        email: text("email"),
    },
    // Case-insensitive expression index used by the back-fill job to look up
    // legacy email rows in bulk. Dropped alongside the column once the
    // identity-node migration has fully rolled out.
    (table) => [
        index("authenticators_email_lower_idx").on(sql`LOWER(${table.email})`),
    ]
);
