import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";

export const identityGroupsTable = pgTable("identity_groups", {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").unique(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const identityNodesTable = pgTable(
    "identity_nodes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityType: text("identity_type", {
            enum: ["anonymous_fingerprint", "merchant_customer", "wallet"],
        }).notNull(),
        identityValue: text("identity_value").notNull(),
        merchantId: uuid("merchant_id"),
        groupId: uuid("group_id")
            .references(() => identityGroupsTable.id, {
                onDelete: "cascade",
            })
            .notNull(),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        unique().on(table.identityType, table.identityValue, table.merchantId),
    ]
);

export const touchpointsTable = pgTable(
    "touchpoints",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id")
            .references(() => identityGroupsTable.id, { onDelete: "cascade" })
            .notNull(),
        merchantId: uuid("merchant_id").notNull(),
        source: text("source", {
            enum: [
                "referral_link",
                "organic_search",
                "paid_ad",
                "social_share",
                "email_campaign",
                "custom_link",
                "direct",
            ],
        }).notNull(),
        sourceData: jsonb("source_data").notNull(),
        landingUrl: text("landing_url"),
        createdAt: timestamp("created_at").defaultNow(),
        expiresAt: timestamp("expires_at"),
    },
    (table) => [
        index().on(table.identityGroupId, table.merchantId),
        index().on(table.expiresAt),
    ]
);
