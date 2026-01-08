import {
    bigint,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address, Hex } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";
import { campaignRulesTable } from "../../campaign/db/schema";
import { identityGroupsTable } from "../../identity/db/schema";
import { merchantsTable } from "../../merchant/db/schema";
import type { InteractionPayload } from "../types";

export const interactionTypeEnum = pgEnum("interaction_type", [
    "referral_arrival",
    "purchase",
    "wallet_connect",
    "identity_merge",
]);

export const interactionLogsTable = pgTable(
    "interaction_logs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        type: interactionTypeEnum("type").notNull(),
        identityGroupId: uuid("identity_group_id").references(
            () => identityGroupsTable.id,
            { onDelete: "set null" }
        ),
        merchantId: uuid("merchant_id").references(() => merchantsTable.id, {
            onDelete: "set null",
        }),
        payload: jsonb("payload").$type<InteractionPayload>().notNull(),
        processedAt: timestamp("processed_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("interaction_logs_identity_group_idx").on(table.identityGroupId),
        index("interaction_logs_merchant_idx").on(table.merchantId),
        index("interaction_logs_type_idx").on(table.type),
        index("interaction_logs_created_at_idx").on(table.createdAt),
        index("interaction_logs_processed_at_idx").on(table.processedAt),
    ]
);

export type InteractionLogInsert = typeof interactionLogsTable.$inferInsert;
export type InteractionLogSelect = typeof interactionLogsTable.$inferSelect;

export const assetStatusEnum = pgEnum("asset_status", [
    "pending",
    "ready_to_claim",
    "claimed",
    "consumed",
    "cancelled",
]);

export const assetTypeEnum = pgEnum("asset_type", [
    "token",
    "discount",
    "points",
]);

export const recipientTypeEnum = pgEnum("recipient_type", [
    "referrer",
    "referee",
    "user",
]);

export const assetLogsTable = pgTable(
    "asset_logs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id")
            .references(() => identityGroupsTable.id, { onDelete: "set null" })
            .notNull(),
        merchantId: uuid("merchant_id")
            .references(() => merchantsTable.id, { onDelete: "set null" })
            .notNull(),
        campaignRuleId: uuid("campaign_rule_id").references(
            () => campaignRulesTable.id,
            { onDelete: "set null" }
        ),

        assetType: assetTypeEnum("asset_type").notNull(),
        amount: numeric("amount", { precision: 36, scale: 18 }).notNull(),
        tokenAddress: customHex("token_address").$type<Address>(),

        recipientType: recipientTypeEnum("recipient_type").notNull(),
        recipientWallet: customHex("recipient_wallet").$type<Address>(),
        chainDepth: integer("chain_depth"),

        status: assetStatusEnum("status").notNull().default("pending"),
        statusChangedAt: timestamp("status_changed_at").defaultNow().notNull(),

        touchpointId: uuid("touchpoint_id"),
        purchaseId: text("purchase_id"),
        interactionLogId: uuid("interaction_log_id").references(
            () => interactionLogsTable.id,
            { onDelete: "set null" }
        ),

        onchainTxHash: customHex("onchain_tx_hash").$type<Hex>(),
        onchainBlock: bigint("onchain_block", { mode: "bigint" }),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("asset_logs_identity_group_idx").on(table.identityGroupId),
        index("asset_logs_merchant_idx").on(table.merchantId),
        index("asset_logs_campaign_rule_idx").on(table.campaignRuleId),
        index("asset_logs_status_idx").on(table.status),
        index("asset_logs_status_merchant_idx").on(
            table.status,
            table.merchantId
        ),
        index("asset_logs_recipient_wallet_idx").on(table.recipientWallet),
        index("asset_logs_interaction_log_idx").on(table.interactionLogId),
        index("asset_logs_created_at_idx").on(table.createdAt),
    ]
);

export type AssetLogInsert = typeof assetLogsTable.$inferInsert;
export type AssetLogSelect = typeof assetLogsTable.$inferSelect;
