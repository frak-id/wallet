import { sql } from "drizzle-orm";
import {
    bigint,
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address, Hex } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";
import type {
    AssetStatus,
    AssetType,
    InteractionType,
    RecipientType,
} from "../schemas";
import type { InteractionPayload } from "../types";

export const interactionLogsTable = pgTable(
    "interaction_logs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        type: text("type").$type<InteractionType>().notNull(),
        identityGroupId: uuid("identity_group_id"),
        merchantId: uuid("merchant_id"),
        externalEventId: text("external_event_id"),
        payload: jsonb("payload").$type<InteractionPayload>().notNull(),
        processedAt: timestamp("processed_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("interaction_logs_identity_group_idx").on(table.identityGroupId),
        index("interaction_logs_merchant_idx").on(table.merchantId),
        index("interaction_logs_created_at_idx").on(table.createdAt),
        uniqueIndex("interaction_logs_external_event_unique_idx").on(
            table.merchantId,
            table.type,
            table.externalEventId
        ),
        index("interaction_logs_sharing_timestamp_idx")
            .using("btree", sql`((payload->>'sharingTimestamp')::int)`)
            .where(sql`"type" = 'create_referral_link'`),
        index("interaction_logs_unprocessed_idx")
            .on(table.createdAt)
            .where(
                sql`"processed_at" IS NULL AND "identity_group_id" IS NOT NULL`
            ),
    ]
);

export type InteractionLogInsert = typeof interactionLogsTable.$inferInsert;
export type InteractionLogSelect = typeof interactionLogsTable.$inferSelect;

export const assetLogsTable = pgTable(
    "asset_logs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id").notNull(),
        merchantId: uuid("merchant_id").notNull(),
        campaignRuleId: uuid("campaign_rule_id"),

        assetType: text("asset_type").$type<AssetType>().notNull(),
        amount: numeric("amount", { precision: 36, scale: 18 }).notNull(),
        tokenAddress: customHex("token_address").$type<Address>(),

        recipientType: text("recipient_type").$type<RecipientType>().notNull(),
        recipientWallet: customHex("recipient_wallet").$type<Address>(),
        chainDepth: integer("chain_depth"),

        status: text("status")
            .$type<AssetStatus>()
            .notNull()
            .default("pending"),
        statusChangedAt: timestamp("status_changed_at").defaultNow().notNull(),

        touchpointId: uuid("touchpoint_id"),
        interactionLogId: uuid("interaction_log_id"),

        onchainTxHash: customHex("onchain_tx_hash").$type<Hex>(),
        onchainBlock: bigint("onchain_block", { mode: "bigint" }),

        settlementAttempts: integer("settlement_attempts").notNull().default(0),
        lastSettlementError: text("last_settlement_error"),

        createdAt: timestamp("created_at").defaultNow().notNull(),
        settledAt: timestamp("settled_at"),
        expiresAt: timestamp("expires_at"),
    },
    (table) => [
        index("asset_logs_identity_group_idx").on(table.identityGroupId),
        index("asset_logs_merchant_idx").on(table.merchantId),
        index("asset_logs_campaign_rule_idx").on(table.campaignRuleId),
        index("asset_logs_interaction_log_idx").on(table.interactionLogId),
        index("asset_logs_created_at_idx").on(table.createdAt),
        index("asset_logs_settlement_retry_idx").on(
            table.status,
            table.settlementAttempts
        ),
        index("asset_logs_settlement_pending_idx").on(
            table.status,
            table.assetType,
            table.settlementAttempts,
            table.createdAt
        ),
        index("asset_logs_expires_at_idx").on(table.expiresAt),
        index("asset_logs_pending_expirable_idx")
            .on(table.expiresAt)
            .where(
                sql`"status" = 'pending' AND "expires_at" IS NOT NULL AND "campaign_rule_id" IS NOT NULL`
            ),
        index("asset_logs_processing_status_changed_idx")
            .on(table.statusChangedAt)
            .where(sql`"status" = 'processing'`),
    ]
);

export type AssetLogInsert = typeof assetLogsTable.$inferInsert;
export type AssetLogSelect = typeof assetLogsTable.$inferSelect;
