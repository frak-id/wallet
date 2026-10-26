import {
    boolean,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

/**
 * The Instagram account an identity group linked for the Frak Game. `igsid` is
 * kept exactly as Meta sends it (scoped to our app); `username` is display-only
 * and can change, so nothing keys on it.
 */
export const instagramLinksTable = pgTable(
    "instagram_links",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id").notNull(),
        igsid: text("igsid").notNull(),
        username: text("username").notNull(),
        /** Whether the account followed @frak_fr at `checkedAt`. */
        follows: boolean("follows").notNull(),
        checkedAt: timestamp("checked_at").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        // One account per identity, and one identity per account: a shared
        // Instagram account must not earn tickets for several wallets.
        uniqueIndex("instagram_links_identity_group_idx").on(
            table.identityGroupId
        ),
        uniqueIndex("instagram_links_igsid_idx").on(table.igsid),
    ]
);

export type InstagramLinkInsert = typeof instagramLinksTable.$inferInsert;
export type InstagramLinkSelect = typeof instagramLinksTable.$inferSelect;
