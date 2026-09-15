import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * WebAuthn credentials, in sqld (libSQL), shared across all environments and
 * append-only: a row is inserted at register, never updated or deleted.
 * `smart_wallet_address` and `email` are legacy — the sources of truth are the
 * postgres `authenticator_wallet_bindings` (chain- and env-scoped) and
 * `identity_nodes` rows; here they are read only by the bootstrap back-fill.
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
    // legacy email rows in bulk.
    (table) => [
        index("authenticators_email_lower_idx").on(sql`LOWER(${table.email})`),
    ]
);
