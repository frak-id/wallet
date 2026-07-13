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

/** Login method that minted a session (drives 2FA semantics). */
export type BusinessAuthMethod = "siwe" | "password" | "shopify";

/**
 * Purpose of an email OTP challenge.
 *  - `second_factor` — login-completion / step-up code (single unified purpose:
 *    verifying it always refreshes `two_factor_verified_at`).
 *  - `email_verify`  — proves ownership of the account email (registration +
 *    email 2FA enrollment share this purpose).
 *  - `password_reset` — unauthenticated forgotten-password recovery: the OTP
 *    proves email ownership before a new password is set (§P1).
 */
export type BusinessEmailCodePurpose =
    | "second_factor"
    | "email_verify"
    | "password_reset";

/**
 * First-class business identity, decoupled from the wallet. A business
 * account holds AT MOST one of each login method — email/password, Shopify
 * identity, wallet — inlined as nullable columns rather than a
 * one-row-per-credential child table: teams never share an account (each
 * member gets their own via `merchant_admins`), so "N credentials of the
 * same type per account" never happens and the extra table/join bought
 * nothing (design doc §4.3, §9 table-count rationale). TOTP enrollment is
 * inlined the same way — it's already 1:1 with the account.
 *
 * A jsonb `credentials` blob was considered and rejected: per-type
 * uniqueness (one wallet ⇒ one account, one shopify identity ⇒ one account)
 * needs real (partial) unique indexes, which on jsonb degrade to fragile
 * expression indexes that silently stop matching the moment the JSON shape
 * changes — typed nullable columns keep the constraints in the schema, not
 * in application discipline.
 *
 * Email is stored lowercased app-side.
 */
export const businessAccountsTable = pgTable(
    "business_accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        email: text("email"),
        emailVerifiedAt: timestamp("email_verified_at"),

        // --- password credential ---
        passwordHash: text("password_hash"),

        // --- shopify credential (design doc §4.7 / §4.12) ---
        shopifyUserId: text("shopify_user_id"),
        shopifyShopDomain: text("shopify_shop_domain"),

        // --- wallet credential ---
        walletAddress: customHex("wallet_address").$type<Address>(),

        // --- TOTP enrollment (mirrors the former business_totp table) ---
        totpSecretEnc: customHex("totp_secret_enc").$type<Hex>(),
        totpActivatedAt: timestamp("totp_activated_at"),
        totpRecoveryCodesHash: text("totp_recovery_codes_hash").array(),

        // --- per-account 2FA verification lockout (TOTP + recovery, §1.8) ---
        // Windowed failed-attempt counter mirroring the email-OTP cap, but
        // keyed on the account (the IP-keyed limiter is trivially bypassable).
        twoFactorAttempts: integer("two_factor_attempts").notNull().default(0),
        twoFactorWindowStartedAt: timestamp("two_factor_window_started_at"),

        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("business_accounts_email_idx")
            .on(table.email)
            .where(sql`email IS NOT NULL`),
        // A wallet can only ever belong to one account.
        uniqueIndex("business_accounts_wallet_idx")
            .on(table.walletAddress)
            .where(sql`wallet_address IS NOT NULL`),
        // A Shopify staff member (at one shop) maps to exactly one account.
        uniqueIndex("business_accounts_shopify_idx")
            .on(table.shopifyUserId, table.shopifyShopDomain)
            .where(
                sql`shopify_user_id IS NOT NULL AND shopify_shop_domain IS NOT NULL`
            ),
    ]
);

export type BusinessAccountSelect = typeof businessAccountsTable.$inferSelect;

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
        // Rolling hourly send-rate window (~5 sends/hour, §6). Reset (count=1,
        // windowStartedAt=now) whenever a send happens more than an hour after
        // the window began; otherwise incremented in place.
        sendCount: integer("send_count").notNull().default(1),
        sendWindowStartedAt: timestamp("send_window_started_at")
            .notNull()
            .defaultNow(),
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
