import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";

export const touchpointSourceEnum = pgEnum("touchpoint_source", [
    "referral_link",
    "organic",
    "paid_ad",
    "direct",
]);

export type TouchpointSourceData =
    | {
          type: "referral_link";
          referrerWallet: Address;
      }
    | {
          type: "organic";
      }
    | {
          type: "paid_ad";
          utmSource?: string;
          utmMedium?: string;
          utmCampaign?: string;
          utmTerm?: string;
          utmContent?: string;
      }
    | {
          type: "direct";
      };

export const touchpointsTable = pgTable(
    "touchpoints",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id").notNull(),
        merchantId: uuid("merchant_id").notNull(),
        source: touchpointSourceEnum("source").notNull(),
        sourceData: jsonb("source_data")
            .$type<TouchpointSourceData>()
            .notNull(),
        landingUrl: text("landing_url"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        expiresAt: timestamp("expires_at"),
    },
    (table) => [
        index("touchpoints_identity_group_idx").on(table.identityGroupId),
        index("touchpoints_merchant_idx").on(table.merchantId),
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
        merchantId: uuid("merchant_id").notNull(),
        referrerIdentityGroupId: uuid("referrer_identity_group_id").notNull(),
        refereeIdentityGroupId: uuid("referee_identity_group_id").notNull(),
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
