import {
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";

export const campaignRulesTable = pgTable(
    "campaign_rules",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        name: text("name").notNull(),
        priority: integer("priority").default(0).notNull(),
        rule: jsonb("rule").notNull(),
        budget: jsonb("budget"),
        linkedTouchpointSource: text("linked_touchpoint_source", {
            enum: [
                "referral_link",
                "organic_search",
                "paid_ad",
                "social_share",
                "email_campaign",
                "custom_link",
                "direct",
            ],
        }),
        linkedTouchpointCode: text("linked_touchpoint_code"),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
        expiresAt: timestamp("expires_at"),
        deactivatedAt: timestamp("deactivated_at"),
    },
    (table) => [index().on(table.merchantId)]
);

export const attributionRulesTable = pgTable(
    "attribution_rules",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        name: text("name").notNull(),
        priority: integer("priority").notNull(),
        rule: jsonb("rule").notNull(),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
        deactivatedAt: timestamp("deactivated_at"),
    },
    (table) => [
        index().on(table.merchantId),
        unique().on(table.merchantId, table.priority),
    ]
);
