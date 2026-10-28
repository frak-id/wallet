import { sql } from "drizzle-orm";
import {
    boolean,
    check,
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

/**
 * An identity group's Instagram before it is certified: the handle it typed
 * (tickets count, nothing proven) and the code it DMs to @frak_fr. Deleted on
 * certification. The handle is not unique: only a certified IGSID can win.
 */
export const instagramPendingLinksTable = pgTable(
    "instagram_pending_links",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id").notNull(),
        username: text("username"),
        declaredAt: timestamp("declared_at"),
        code: text("code"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("instagram_pending_links_identity_group_idx").on(
            table.identityGroupId
        ),
        uniqueIndex("instagram_pending_links_code_idx").on(table.code),
        check(
            "instagram_pending_links_declared_check",
            sql`("username" IS NULL) = ("declared_at" IS NULL)`
        ),
    ]
);

export type InstagramPendingLinkSelect =
    typeof instagramPendingLinksTable.$inferSelect;

/** A pending row carrying a typed handle. */
export type InstagramDeclarationSelect = Pick<
    InstagramPendingLinkSelect,
    "id" | "identityGroupId"
> & { username: string; declaredAt: Date };

/** The connected account's token, encrypted; `seed_hash` spots a hand-rotated env token. */
export const instagramAccessTokensTable = pgTable("instagram_access_tokens", {
    account: text("account").primaryKey(),
    tokenEncrypted: text("token_encrypted").notNull(),
    seedHash: text("seed_hash").notNull(),
    refreshedAt: timestamp("refreshed_at").notNull(),
    expiresAt: timestamp("expires_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InstagramAccessTokenSelect =
    typeof instagramAccessTokensTable.$inferSelect;
