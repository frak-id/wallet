import { sql } from "drizzle-orm";
import {
    check,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import type {
    ReferralLinkScope,
    ReferralLinkSource,
    TouchpointSource,
    TouchpointSourceData,
} from "../schemas/index";

export const TouchpointSources = [
    "referral_link",
    "organic",
    "paid_ad",
    "direct",
] as const;

export const touchpointsTable = pgTable(
    "touchpoints",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id").notNull(),
        merchantId: uuid("merchant_id").notNull(),
        source: text("source").$type<TouchpointSource>().notNull(),
        sourceData: jsonb("source_data")
            .$type<TouchpointSourceData>()
            .notNull(),
        landingUrl: text("landing_url"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        expiresAt: timestamp("expires_at"),
    },
    (table) => [
        index("touchpoints_identity_merchant_idx").on(
            table.identityGroupId,
            table.merchantId
        ),
        index("touchpoints_expires_at_idx").on(table.expiresAt),
    ]
);

export const referralLinksTable = pgTable(
    "referral_links",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        // Scope distinguishes per-merchant referrals (current product) from
        // cross-merchant ones (referral codes, coupon codes). The CHECK
        // constraint below enforces that merchantId is NULL iff scope is
        // cross-merchant.
        scope: text("scope")
            .$type<ReferralLinkScope>()
            .notNull()
            .default("merchant"),
        merchantId: uuid("merchant_id"),
        referrerIdentityGroupId: uuid("referrer_identity_group_id").notNull(),
        refereeIdentityGroupId: uuid("referee_identity_group_id").notNull(),
        // Origin of the relationship (analytics / debugging only — does not
        // affect lookup semantics). Reserved value 'coupon' is unused in
        // Phase 1; it will land with merchant coupon codes.
        source: text("source")
            .$type<ReferralLinkSource>()
            .notNull()
            .default("link"),
        // FK to referral_codes.id when source='code'. Kept nullable for
        // link / coupon rows.
        referralCodeId: uuid("referral_code_id"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        // Phase 2 hook — unused today. When set, readers must filter
        // `expiresAt IS NULL OR expiresAt > now()`.
        expiresAt: timestamp("expires_at"),
    },
    (table) => [
        check(
            "referral_links_scope_merchant_check",
            sql`("scope" = 'merchant' AND "merchant_id" IS NOT NULL) OR ("scope" = 'cross_merchant' AND "merchant_id" IS NULL)`
        ),
        // One referrer per user per merchant for scope='merchant'.
        uniqueIndex("referral_links_merchant_referee_unique")
            .on(table.merchantId, table.refereeIdentityGroupId)
            .where(sql`"scope" = 'merchant'`),
        // One cross-merchant referrer per user (global referrer of last
        // resort — first redemption wins).
        uniqueIndex("referral_links_cross_merchant_referee_unique")
            .on(table.refereeIdentityGroupId)
            .where(sql`"scope" = 'cross_merchant'`),
        index("referral_links_referrer_idx").on(table.referrerIdentityGroupId),
        index("referral_links_referee_idx").on(table.refereeIdentityGroupId),
    ]
);

export type ReferralLinkInsert = typeof referralLinksTable.$inferInsert;
export type ReferralLinkSelect = typeof referralLinksTable.$inferSelect;
