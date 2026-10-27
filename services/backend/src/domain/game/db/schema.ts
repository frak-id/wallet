import { sql } from "drizzle-orm";
import {
    check,
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import type {
    DrawEntry,
    DrawRejection,
    DrawStatus,
    GameStatus,
} from "../schemas";

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

/**
 * One draw per game. `snapshot_root` and `drand_round` are published at
 * freeze, before the round exists; `entries` is written once and is exactly
 * what the root hashes. `pid_key` stays private: it maps players to pids.
 */
export const gameDrawsTable = pgTable(
    "game_draws",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        gameId: uuid("game_id").notNull(),
        algorithm: text("algorithm").notNull(),
        status: text("status").$type<DrawStatus>().notNull(),
        frozenAt: timestamp("frozen_at").notNull(),
        pidKey: text("pid_key").notNull(),
        snapshotRoot: text("snapshot_root").notNull(),
        totalTickets: integer("total_tickets").notNull(),
        entries: jsonb("entries").$type<DrawEntry[]>().notNull(),
        drandChainHash: text("drand_chain_hash").notNull(),
        drandRound: integer("drand_round").notNull(),
        drandSignature: text("drand_signature"),
        candidates: jsonb("candidates").$type<string[]>(),
        rejections: jsonb("rejections")
            .$type<DrawRejection[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        winnerIdentityGroupId: uuid("winner_identity_group_id"),
        confirmedBy: text("confirmed_by"),
        confirmedAt: timestamp("confirmed_at"),
        assetLogId: uuid("asset_log_id"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("game_draws_game_idx").on(table.gameId),
        index("game_draws_status_idx").on(table.status),
        check(
            "game_draws_status_check",
            sql`"status" IN ('frozen', 'drawn', 'confirmed', 'void')`
        ),
    ]
);

export type GameDrawInsert = typeof gameDrawsTable.$inferInsert;
export type GameDrawSelect = typeof gameDrawsTable.$inferSelect;
