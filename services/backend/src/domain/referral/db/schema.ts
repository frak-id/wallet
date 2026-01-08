import { index, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { identityGroupsTable } from "../../identity/db/schema";
import { merchantsTable } from "../../merchant/db/schema";

export const referralLinksTable = pgTable(
    "referral_links",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id")
            .references(() => merchantsTable.id, { onDelete: "cascade" })
            .notNull(),
        referrerIdentityGroupId: uuid("referrer_identity_group_id")
            .references(() => identityGroupsTable.id, { onDelete: "cascade" })
            .notNull(),
        refereeIdentityGroupId: uuid("referee_identity_group_id")
            .references(() => identityGroupsTable.id, { onDelete: "cascade" })
            .notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        unique("referral_links_merchant_referee_unique").on(
            table.merchantId,
            table.refereeIdentityGroupId
        ),
        index("referral_links_merchant_idx").on(table.merchantId),
        index("referral_links_referrer_idx").on(table.referrerIdentityGroupId),
        index("referral_links_referee_idx").on(table.refereeIdentityGroupId),
    ]
);

export type ReferralLinkInsert = typeof referralLinksTable.$inferInsert;
export type ReferralLinkSelect = typeof referralLinksTable.$inferSelect;
