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

/**
 * A handle the player typed: their tickets count in the draw, but nothing is
 * proven until they certify. Not unique: only a certified IGSID can win.
 */
export const instagramDeclarationsTable = pgTable(
    "instagram_declarations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id").notNull(),
        username: text("username").notNull(),
        declaredAt: timestamp("declared_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("instagram_declarations_identity_group_idx").on(
            table.identityGroupId
        ),
    ]
);

export type InstagramDeclarationSelect =
    typeof instagramDeclarationsTable.$inferSelect;

/** The code a player DMs to @frak_fr to certify: one per identity group, deleted once used. */
export const instagramLinkCodesTable = pgTable(
    "instagram_link_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id").notNull(),
        code: text("code").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("instagram_link_codes_identity_group_idx").on(
            table.identityGroupId
        ),
        uniqueIndex("instagram_link_codes_code_idx").on(table.code),
    ]
);

export type InstagramLinkCodeSelect =
    typeof instagramLinkCodesTable.$inferSelect;

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
