import {
    bigint,
    index,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";

export const assetStatusEnum = pgEnum("asset_status", [
    "pending",
    "ready",
    "ready_to_claim",
    "claimed",
    "consumed",
    "expired",
    "cancelled",
]);

export const assetLogsTable = pgTable(
    "asset_logs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id").notNull(),
        merchantId: uuid("merchant_id").notNull(),
        campaignRuleId: uuid("campaign_rule_id"),
        assetType: text("asset_type").notNull(),
        amount: numeric("amount").notNull(),
        currency: text("currency"),
        recipientType: text("recipient_type").notNull(),
        status: assetStatusEnum("status").default("pending").notNull(),
        statusChangedAt: timestamp("status_changed_at").defaultNow(),
        eventStreamIds: jsonb("event_stream_ids").default("{}"),
        touchpointId: uuid("touchpoint_id"),
        purchaseId: text("purchase_id"),
        referrerWallet: text("referrer_wallet"),
        onchainTxHash: text("onchain_tx_hash"),
        onchainBlock: bigint("onchain_block", { mode: "bigint" }),
        createdAt: timestamp("created_at").defaultNow(),
        claimableAt: timestamp("claimable_at"),
        expiresAt: timestamp("expires_at"),
    },
    (table) => [
        index().on(table.identityGroupId),
        index().on(table.status),
        index().on(table.claimableAt),
        index().on(table.referrerWallet),
    ]
);

export const eventStreamTable = pgTable(
    "event_stream",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        eventType: text("event_type", {
            enum: [
                "referral_arrival",
                "wallet_connect",
                "purchase",
                "account_create",
                "identity_merge",
                "reward_created",
                "reward_ready",
                "reward_settled",
                "reward_claimed",
            ],
        }).notNull(),
        identityGroupId: uuid("identity_group_id"),
        merchantId: uuid("merchant_id"),
        payload: jsonb("payload").notNull(),
        correlationId: uuid("correlation_id"),
        causationId: uuid("causation_id"),
        occurredAt: timestamp("occurred_at").notNull(),
        recordedAt: timestamp("recorded_at").defaultNow(),
    },
    (table) => [
        index().on(table.eventType),
        index().on(table.identityGroupId),
        index().on(table.merchantId),
        index().on(table.occurredAt),
        index().on(table.correlationId),
    ]
);
