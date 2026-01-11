import {
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address, Hex } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";

export type PendingPurchaseValidation = {
    orderId: string;
    purchaseToken: string;
};

export type MergedGroup = {
    groupId: string;
    mergedAt: string;
};

export const identityGroupsTable = pgTable("identity_groups", {
    id: uuid("id").primaryKey().defaultRandom(),
    mergedGroups: jsonb("merged_groups").$type<MergedGroup[]>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const identityTypeEnum = pgEnum("identity_type", [
    "anonymous_fingerprint",
    "merchant_customer",
    "wallet",
]);

export const identityNodesTable = pgTable(
    "identity_nodes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        groupId: uuid("group_id")
            .references(() => identityGroupsTable.id, { onDelete: "cascade" })
            .notNull(),
        identityType: identityTypeEnum("identity_type").notNull(),
        identityValue: text("identity_value").notNull(),
        merchantId: uuid("merchant_id"),
        validationData:
            jsonb("validation_data").$type<PendingPurchaseValidation>(),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        unique("identity_nodes_unique_identity").on(
            table.identityType,
            table.identityValue,
            table.merchantId
        ),
        index("identity_nodes_group_idx").on(table.groupId),
        index("identity_nodes_type_value_idx").on(
            table.identityType,
            table.identityValue
        ),
    ]
);

export const identityResolutionStatusEnum = pgEnum(
    "identity_resolution_status",
    ["pending", "processing", "completed", "failed"]
);

export const pendingIdentityResolutionsTable = pgTable(
    "pending_identity_resolutions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        groupId: uuid("group_id").notNull(),
        walletAddress: customHex("wallet_address").$type<Address>().notNull(),
        status: identityResolutionStatusEnum("status")
            .notNull()
            .default("pending"),
        attempts: integer("attempts").notNull().default(0),
        lastError: text("last_error"),
        onchainTxHash: customHex("onchain_tx_hash").$type<Hex>(),
        onchainBlock: text("onchain_block"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        processedAt: timestamp("processed_at"),
    },
    (table) => [
        index("pending_identity_resolutions_status_idx").on(table.status),
        index("pending_identity_resolutions_created_at_idx").on(
            table.createdAt
        ),
        index("pending_identity_resolutions_wallet_idx").on(
            table.walletAddress
        ),
    ]
);

export type PendingIdentityResolutionInsert =
    typeof pendingIdentityResolutionsTable.$inferInsert;
export type PendingIdentityResolutionSelect =
    typeof pendingIdentityResolutionsTable.$inferSelect;
export type IdentityResolutionStatus =
    PendingIdentityResolutionSelect["status"];
