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
    ReferralLinkEndReason,
    ReferralLinkScope,
    ReferralLinkSource,
    ReferralLinkSourceData,
} from "../schemas/index";

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
        // Origin of the relationship. `link` = shared-link click,
        // `code` = referral-code redemption. Drives the shape of `sourceData`.
        source: text("source")
            .$type<ReferralLinkSource>()
            .notNull()
            .default("link"),
        // Per-source metadata. Discriminated by `source`:
        //   - source='link' → { type: 'link', sharedAt?: number }
        //   - source='code' → { type: 'code', codeId: uuid }
        sourceData: jsonb("source_data").$type<ReferralLinkSourceData>(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        // User-driven (or system-driven) soft-delete marker. When set, the row
        // is treated as inactive by all read paths and partial uniques, while
        // staying physically present so the audit trail and downstream FKs
        // (`asset_logs.referral_link_id`, `referral_codes` lookups) survive.
        // Set by `ReferralLinkRepository.removeReferrer` and by
        // `IdentityMergeService` when collapsing conflicting/self-loop rows.
        removedAt: timestamp("removed_at"),
        // Companion to `removedAt`. Discriminates why the row went inactive,
        // see `ReferralLinkEndReason` for the value catalogue. Always NULL
        // while `removedAt` is NULL.
        endReason: text("end_reason").$type<ReferralLinkEndReason>(),
    },
    (table) => [
        check(
            "referral_links_scope_merchant_check",
            sql`("scope" = 'merchant' AND "merchant_id" IS NOT NULL) OR ("scope" = 'cross_merchant' AND "merchant_id" IS NULL)`
        ),
        // Self-loops are meaningless (a user cannot refer themselves) and
        // break chain-walker termination plus the reward pipeline's
        // `findReferrerForReferee`. Enforced at the DB as defence-in-depth
        // against bugs in write paths like `IdentityMergeService`.
        check(
            "referral_links_no_self_loop_check",
            sql`"referrer_identity_group_id" <> "referee_identity_group_id"`
        ),
        // One ACTIVE referrer per user per merchant for scope='merchant'.
        // `removed_at IS NULL` lets a user revoke their merchant-scope
        // referrer (e.g. for a previously-clicked share link) and pick up a
        // new one without losing history.
        uniqueIndex("referral_links_merchant_referee_unique")
            .on(table.merchantId, table.refereeIdentityGroupId)
            .where(sql`"scope" = 'merchant' AND "removed_at" IS NULL`),
        // One ACTIVE cross-merchant referrer per user (global referrer of
        // last resort). The `removed_at IS NULL` guard supports the
        // remove + re-redeem flow (UserC entered code A, removed it, then
        // entered code B — both rows preserved, only the latest is active).
        uniqueIndex("referral_links_cross_merchant_referee_unique")
            .on(table.refereeIdentityGroupId)
            .where(sql`"scope" = 'cross_merchant' AND "removed_at" IS NULL`),
        index("referral_links_referrer_idx").on(table.referrerIdentityGroupId),
        index("referral_links_referee_idx").on(table.refereeIdentityGroupId),
    ]
);

export type ReferralLinkInsert = typeof referralLinksTable.$inferInsert;
export type ReferralLinkSelect = typeof referralLinksTable.$inferSelect;
