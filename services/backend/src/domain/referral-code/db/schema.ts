import { sql } from "drizzle-orm";
import {
    check,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import type { ReferralCodeKind } from "../schemas";

export const referralCodesTable = pgTable(
    "referral_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        code: varchar("code", { length: 6 }).notNull(),
        ownerIdentityGroupId: uuid("owner_identity_group_id").notNull(),
        kind: text("kind").$type<ReferralCodeKind>().notNull().default("user"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        // Rotation / opt-out marker. NULL for the single active row per owner;
        // non-NULL archives the code while preserving FK integrity for
        // historical referral_links rows.
        revokedAt: timestamp("revoked_at"),
    },
    (table) => [
        check("referral_codes_kind_check", sql`"kind" IN ('user', 'frak')`),
        // Only one active row may hold a given code.
        uniqueIndex("referral_codes_code_active_idx")
            .on(table.code)
            .where(sql`"revoked_at" IS NULL`),
        // Only one active user code per owner; Frak holds many active codes.
        uniqueIndex("referral_codes_owner_active_idx")
            .on(table.ownerIdentityGroupId)
            .where(sql`"revoked_at" IS NULL AND "kind" = 'user'`),
    ]
);

export type ReferralCodeInsert = typeof referralCodesTable.$inferInsert;
export type ReferralCodeSelect = typeof referralCodesTable.$inferSelect;
