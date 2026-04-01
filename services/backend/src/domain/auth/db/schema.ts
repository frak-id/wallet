import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Authenticator credentials table for WebAuthn
 *  - Stored in sqld (libSQL) instead of MongoDB
 *  - Append-only: credentials are inserted once and never updated or deleted
 *  - Shared across all environments (origin-bound WebAuthn credentials)
 */
export const authenticatorsTable = sqliteTable("authenticators", {
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
});
