import {
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { merchantsTable } from "../../merchant/db/schema";
import type {
    BudgetConfig,
    BudgetUsed,
    CampaignMetadata,
    CampaignRuleDefinition,
} from "../types";

export const campaignRulesTable = pgTable(
    "campaign_rules",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id")
            .references(() => merchantsTable.id, { onDelete: "cascade" })
            .notNull(),
        name: text("name").notNull(),
        priority: integer("priority").notNull().default(0),
        rule: jsonb("rule").$type<CampaignRuleDefinition>().notNull(),
        metadata: jsonb("metadata").$type<CampaignMetadata>(),
        budgetConfig: jsonb("budget_config").$type<BudgetConfig>(),
        budgetUsed: jsonb("budget_used").$type<BudgetUsed>().default({}),
        expiresAt: timestamp("expires_at"),
        deactivatedAt: timestamp("deactivated_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        index("campaign_rules_merchant_idx").on(table.merchantId),
        index("campaign_rules_merchant_active_idx").on(
            table.merchantId,
            table.deactivatedAt
        ),
        index("campaign_rules_priority_idx").on(table.priority),
    ]
);

export type CampaignRuleInsert = typeof campaignRulesTable.$inferInsert;
export type CampaignRuleSelect = typeof campaignRulesTable.$inferSelect;
