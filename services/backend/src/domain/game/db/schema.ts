import { sql } from "drizzle-orm";
import {
    check,
    index,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import type { DropStatus } from "../schemas";

/**
 * A Frak Game round. Joining it is redeeming `referral_code_id`; the reward
 * comes from `campaign_rule_id` (a `drop_join` rule on the Frak merchant)
 * and its budget is the participant cap.
 */
export const dropsTable = pgTable(
    "drops",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        referralCodeId: uuid("referral_code_id").notNull(),
        campaignRuleId: uuid("campaign_rule_id").notNull(),
        sponsorMerchantId: uuid("sponsor_merchant_id"),
        prizeDescription: text("prize_description").notNull(),
        startsAt: timestamp("starts_at").notNull(),
        endsAt: timestamp("ends_at").notNull(),
        status: text("status").$type<DropStatus>().notNull().default("active"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("drops_referral_code_idx").on(table.referralCodeId),
        index("drops_ends_at_idx").on(table.endsAt),
        check("drops_status_check", sql`"status" IN ('active', 'paused')`),
        check("drops_window_check", sql`"ends_at" > "starts_at"`),
    ]
);

export type DropInsert = typeof dropsTable.$inferInsert;
export type DropSelect = typeof dropsTable.$inferSelect;
