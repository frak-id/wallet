import { sql } from "drizzle-orm";
import {
    check,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";
import type {
    ExplorerConfig,
    MerchantAccountingInfo,
    SdkConfig,
} from "../schemas";

export const merchantsTable = pgTable(
    "merchants",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        productId: customHex("product_id").unique(),
        domain: text("domain").unique().notNull(),
        allowedDomains: text("allowed_domains").array().default([]).notNull(),
        name: text("name").notNull(),
        // Owner identity — at least one of the two must be set (CHECK below).
        // `ownerWallet` powers onchain bank-role management; `ownerAccountId`
        // (business_accounts FK) powers walletless ownership.
        ownerWallet: customHex("owner_wallet").$type<Address>(),
        ownerAccountId: uuid("owner_account_id"),
        bankAddress: customHex("bank_address").$type<Address>(),
        defaultRewardToken: customHex("default_reward_token")
            .$type<Address>()
            .notNull(),
        webhookSignatureKey: text("webhook_signature_key"),
        webhookPlatform: text("webhook_platform"),
        explorerConfig: jsonb("explorer_config").$type<ExplorerConfig>(),
        explorerEnabledAt: timestamp("explorer_enabled_at"),
        sdkConfig: jsonb("sdk_config").$type<SdkConfig>(),
        accountingInfo:
            jsonb("accounting_info").$type<Partial<MerchantAccountingInfo>>(),
        verifiedAt: timestamp("verified_at"),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
        index("merchants_owner_wallet_idx").on(table.ownerWallet),
        index("merchants_owner_account_idx").on(table.ownerAccountId),
        check(
            "merchants_owner_check",
            sql`${table.ownerWallet} IS NOT NULL OR ${table.ownerAccountId} IS NOT NULL`
        ),
    ]
);

export const merchantAdminsTable = pgTable(
    "merchant_admins",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        // Admin identity — wallet and/or business account (CHECK below).
        wallet: customHex("wallet").$type<Address>(),
        accountId: uuid("account_id"),
        // Who added the admin — wallet or account, whichever the actor had.
        addedBy: customHex("added_by").$type<Address>(),
        addedByAccountId: uuid("added_by_account_id"),
        addedAt: timestamp("added_at").defaultNow().notNull(),
    },
    (table) => [
        index("merchant_admins_wallet_idx").on(table.wallet),
        index("merchant_admins_account_idx").on(table.accountId),
        unique("merchant_admins_unique").on(table.merchantId, table.wallet),
        check(
            "merchant_admins_identity_check",
            sql`${table.wallet} IS NOT NULL OR ${table.accountId} IS NOT NULL`
        ),
    ]
);

export const merchantOwnershipTransfersTable = pgTable(
    "merchant_ownership_transfers",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull().unique(),
        // Source identity — whichever axis the current owner has (§7.5:
        // walletless owners initiate via a step-up-verified session instead
        // of a SIWE proof).
        fromWallet: customHex("from_wallet").$type<Address>(),
        fromAccountId: uuid("from_account_id"),
        // Target identity — a wallet (existing flow, SIWE-accepted) or an
        // existing business account (walletless target, accepted via a
        // step-up-verified session on the target's own account).
        toWallet: customHex("to_wallet").$type<Address>(),
        toAccountId: uuid("to_account_id"),
        initiatedAt: timestamp("initiated_at").defaultNow().notNull(),
        expiresAt: timestamp("expires_at").notNull(),
    },
    (table) => [
        check(
            "merchant_ownership_transfers_from_check",
            sql`${table.fromWallet} IS NOT NULL OR ${table.fromAccountId} IS NOT NULL`
        ),
        check(
            "merchant_ownership_transfers_to_check",
            sql`${table.toWallet} IS NOT NULL OR ${table.toAccountId} IS NOT NULL`
        ),
    ]
);

/**
 * Separate ranking table for explorer ordering.
 * Isolates high-churn ranking data from the core merchant table.
 *
 * Signals are precomputed by a cron job and combined at query time
 * via a dynamic weighted formula (e.g. manualBoost * 100 + activeCampaignScore),
 * so weights can be tuned without recomputing.
 *
 * Planned evolution:
 *  1. activeCampaignScore - precomputed from campaign_rules by cron
 *  2. categoryScore - merchant categories (lifestyle, cosmetics, tech...),
 *     matched against user category preferences at query time
 *  3. Per-user personalization pushed into the DB query (not app-layer)
 *     to preserve correct pagination
 */
export const merchantExplorerRankingTable = pgTable(
    "merchant_explorer_ranking",
    {
        merchantId: uuid("merchant_id").primaryKey(),
        manualBoost: integer("manual_boost").default(0).notNull(),
        // Future signals:
        // activeCampaignScore: integer("active_campaign_score").default(0).notNull(),
        // categoryScore: integer("category_score").default(0).notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    }
);
