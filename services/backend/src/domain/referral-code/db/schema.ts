import { sql } from "drizzle-orm";
import {
    index,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

export const referralCodesTable = pgTable(
    "referral_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        code: varchar("code", { length: 6 }).notNull(),
        ownerIdentityGroupId: uuid("owner_identity_group_id").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        // Rotation / opt-out marker. NULL for the single active row per owner;
        // non-NULL archives the code while preserving FK integrity for
        // historical referral_links rows.
        revokedAt: timestamp("revoked_at"),
    },
    (table) => [
        // Only one active row may hold a given code.
        uniqueIndex("referral_codes_code_active_idx")
            .on(table.code)
            .where(sql`"revoked_at" IS NULL`),
        // Only one active code per owner. Rotation history is preserved.
        uniqueIndex("referral_codes_owner_active_idx")
            .on(table.ownerIdentityGroupId)
            .where(sql`"revoked_at" IS NULL`),
        index("referral_codes_owner_idx").on(table.ownerIdentityGroupId),
    ]
);

export type ReferralCodeInsert = typeof referralCodesTable.$inferInsert;
export type ReferralCodeSelect = typeof referralCodesTable.$inferSelect;
