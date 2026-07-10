import { sql } from "drizzle-orm";
import {
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address, Hex } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";

/**
 * How a credential proves ownership of a business account.
 *  - `password` — email (on the account) + argon2id hash.
 *  - `shopify`  — Shopify staff identity (`associated_user.id` + shop domain).
 *  - `wallet`   — SIWE-proven smart-wallet address.
 */
export type BusinessCredentialType = "password" | "shopify" | "wallet";

/** Login method that minted a session (drives 2FA semantics). */
export type BusinessAuthMethod = "siwe" | "password" | "shopify";

/**
 * Purpose of an email OTP challenge.
 *  - `second_factor` — login-completion / step-up code (single unified purpose:
 *    verifying it always refreshes `two_factor_verified_at`).
 *  - `email_verify`  — proves ownership of the account email (registration +
 *    email 2FA enrollment share this purpose).
 */
export type BusinessEmailCodePurpose = "second_factor" | "email_verify";

/**
 * First-class business identity, decoupled from the wallet. A wallet is one
 * of several credentials attached to an account (see
 * `business_account_credentials`). Email is stored lowercased app-side.
 */
export const businessAccountsTable = pgTable(
    "business_accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        email: text("email"),
        emailVerifiedAt: timestamp("email_verified_at"),
        displayName: text("display_name"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("business_accounts_email_idx")
            .on(table.email)
            .where(sql`email IS NOT NULL`),
    ]
);

export type BusinessAccountSelect = typeof businessAccountsTable.$inferSelect;

/**
 * One row per credential. Column usage per `type`:
 *  - password: `password_hash` (PHC string from argon2id)
 *  - shopify:  `shopify_user_id` + `shop_domain`
 *  - wallet:   `wallet_address`
 */
export const businessAccountCredentialsTable = pgTable(
    "business_account_credentials",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        accountId: uuid("account_id").notNull(),
        type: text("type").$type<BusinessCredentialType>().notNull(),
        passwordHash: text("password_hash"),
        shopifyUserId: text("shopify_user_id"),
        shopDomain: text("shop_domain"),
        walletAddress: customHex("wallet_address").$type<Address>(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("bac_account_idx").on(table.accountId),
        // A wallet can only ever belong to one account.
        uniqueIndex("bac_wallet_idx")
            .on(table.walletAddress)
            .where(sql`type = 'wallet'`),
        // A Shopify staff member maps to exactly one account.
        uniqueIndex("bac_shopify_idx")
            .on(table.shopifyUserId, table.shopDomain)
            .where(sql`type = 'shopify'`),
        // One password credential per account.
        uniqueIndex("bac_password_idx")
            .on(table.accountId)
            .where(sql`type = 'password'`),
    ]
);

export type BusinessCredentialSelect =
    typeof businessAccountCredentialsTable.$inferSelect;

/**
 * DB-backed revocable session (Lucia-guide style). `id` IS the sha256 of the
 * opaque bearer token — the raw token is never stored. `two_factor_verified_at`
 * carries both the pending-login state (null until first 2FA) and the step-up
 * freshness window. `two_factor_nonce` holds the SIWE re-sign challenge.
 */
export const businessSessionsTable = pgTable(
    "business_sessions",
    {
        id: text("id").primaryKey(),
        accountId: uuid("account_id").notNull(),
        authMethod: text("auth_method").$type<BusinessAuthMethod>().notNull(),
        twoFactorVerifiedAt: timestamp("two_factor_verified_at"),
        twoFactorNonce: text("two_factor_nonce"),
        ip: text("ip"),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
    },
    (table) => [
        index("business_sessions_account_idx").on(table.accountId),
        index("business_sessions_expires_idx").on(table.expiresAt),
    ]
);

export type BusinessSessionSelect = typeof businessSessionsTable.$inferSelect;

/**
 * TOTP enrollment, one per account. The secret is AES-256-GCM encrypted with
 * a key derived from `MASTER_KEY_SECRET` (iv ‖ ciphertext ‖ tag, hex-encoded
 * into bytea via `customHex`). `activated_at` null = setup started but not
 * confirmed. Recovery codes are sha256-hashed, single-use (consumed entries
 * are removed from the array).
 */
export const businessTotpTable = pgTable("business_totp", {
    accountId: uuid("account_id").primaryKey(),
    encryptedSecret: customHex("encrypted_secret").$type<Hex>().notNull(),
    activatedAt: timestamp("activated_at"),
    recoveryCodesHash: text("recovery_codes_hash").array(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BusinessTotpSelect = typeof businessTotpTable.$inferSelect;

/**
 * Transient email OTP challenge — mirror of the identity domain's
 * `email_verification_codes` hardening (attempts cap, resend debounce,
 * TTL) with the code hashed at rest. One active row per (account, purpose):
 * a resend upserts in place.
 */
export const businessEmailCodesTable = pgTable(
    "business_email_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        accountId: uuid("account_id").notNull(),
        purpose: text("purpose").$type<BusinessEmailCodePurpose>().notNull(),
        codeHash: text("code_hash").notNull(),
        attempts: integer("attempts").notNull().default(0),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        lastSentAt: timestamp("last_sent_at").notNull().defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
        consumedAt: timestamp("consumed_at"),
    },
    (table) => [
        uniqueIndex("bec_account_purpose_idx").on(
            table.accountId,
            table.purpose
        ),
        index("bec_expires_at_idx").on(table.expiresAt),
    ]
);

export type BusinessEmailCodeSelect =
    typeof businessEmailCodesTable.$inferSelect;
