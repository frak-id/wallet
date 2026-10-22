import { sql } from "drizzle-orm";
import {
    check,
    index,
    numeric,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import type { GameStatus } from "../schemas";

/**
 * A Frak Game round. Joining it is redeeming `referral_code_id`; the reward
 * comes from `campaign_rule_id` (a `game_join` rule on the Frak merchant).
 */
export const gamesTable = pgTable(
    "games",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        referralCodeId: uuid("referral_code_id").notNull(),
        campaignRuleId: uuid("campaign_rule_id").notNull(),
        sponsorMerchantId: uuid("sponsor_merchant_id"),
        prizeAmount: numeric("prize_amount", {
            precision: 12,
            scale: 2,
            mode: "number",
        }).notNull(),
        prizeDescription: text("prize_description"),
        startsAt: timestamp("starts_at").notNull(),
        endsAt: timestamp("ends_at").notNull(),
        status: text("status").$type<GameStatus>().notNull().default("active"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("games_referral_code_idx").on(table.referralCodeId),
        index("games_ends_at_idx").on(table.endsAt),
        check("games_status_check", sql`"status" IN ('active', 'paused')`),
        check("games_window_check", sql`"ends_at" > "starts_at"`),
        check("games_prize_amount_check", sql`"prize_amount" > 0`),
    ]
);

export type GameInsert = typeof gamesTable.$inferInsert;
export type GameSelect = typeof gamesTable.$inferSelect;
