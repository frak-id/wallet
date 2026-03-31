import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import type { IdentityType } from "../schemas";

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

export const identityNodesTable = pgTable(
    "identity_nodes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        groupId: uuid("group_id").notNull(),
        identityType: text("identity_type").$type<IdentityType>().notNull(),
        identityValue: text("identity_value").notNull(),
        merchantId: uuid("merchant_id"),
        validationData:
            jsonb("validation_data").$type<PendingPurchaseValidation>(),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        unique("identity_nodes_unique_identity")
            .on(table.identityType, table.identityValue, table.merchantId)
            .nullsNotDistinct(),
        index("identity_nodes_group_idx").on(table.groupId),
    ]
);

export const installCodesTable = pgTable(
    "install_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        code: varchar("code", { length: 6 }).notNull(),
        merchantId: uuid("merchant_id").notNull(),
        anonymousId: text("anonymous_id").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
    },
    (table) => [
        uniqueIndex("install_codes_code_idx").on(table.code),
        index("install_codes_merchant_anonymous_idx").on(
            table.merchantId,
            table.anonymousId
        ),
        index("install_codes_expires_at_idx").on(table.expiresAt),
    ]
);
