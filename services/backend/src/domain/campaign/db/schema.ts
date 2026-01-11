import {
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";

import type {
    BudgetConfig,
    BudgetUsed,
    CampaignMetadata,
    CampaignRuleDefinition,
} from "../types";

export const campaignStatusEnum = pgEnum("campaign_status", [
    "draft",
    "active",
    "paused",
    "archived",
]);

export type CampaignStatus = (typeof campaignStatusEnum.enumValues)[number];

export const campaignRulesTable = pgTable(
    "campaign_rules",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        name: text("name").notNull(),
        status: campaignStatusEnum("status").notNull().default("draft"),
        priority: integer("priority").notNull().default(0),
        rule: jsonb("rule").$type<CampaignRuleDefinition>().notNull(),
        metadata: jsonb("metadata").$type<CampaignMetadata>(),
        budgetConfig: jsonb("budget_config").$type<BudgetConfig>(),
        budgetUsed: jsonb("budget_used").$type<BudgetUsed>().default({}),
        expiresAt: timestamp("expires_at"),
        publishedAt: timestamp("published_at"),
        deactivatedAt: timestamp("deactivated_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        index("campaign_rules_merchant_idx").on(table.merchantId),
        index("campaign_rules_merchant_status_idx").on(
            table.merchantId,
            table.status
        ),
        index("campaign_rules_priority_idx").on(table.priority),
    ]
);

export type CampaignRuleInsert = typeof campaignRulesTable.$inferInsert;
export type CampaignRuleSelect = typeof campaignRulesTable.$inferSelect;
