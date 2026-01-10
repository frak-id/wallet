import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";

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
