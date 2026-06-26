import {
    index,
    jsonb,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import type { AffiliateProvider } from "../provider";

/**
 * Links an internal `merchants` row to a brand offered by an affiliate
 * `provider`. A merchant may be offered by several providers (e.g. the same
 * brand on TakeAds and another network), so the link is keyed per
 * `(merchantId, provider)` rather than one-to-one.
 *
 * `externalId` is the provider's own brand identifier as **text** (TakeAds uses
 * integers, other networks use strings/GUIDs). `trackingLink` is the brand's
 * base affiliate link; per-user share links are built by setting the provider's
 * sub-id query param on it. `metadata` carries any provider-specific extras so
 * new providers don't need a schema change.
 */
export const affiliateBrandTable = pgTable(
    "affiliate_brand",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        provider: text("provider").$type<AffiliateProvider>().notNull(),
        externalId: text("external_id").notNull(),
        trackingLink: text("tracking_link").notNull(),
        metadata: jsonb("metadata").$type<Record<string, unknown>>(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        // One link per (merchant, provider).
        uniqueIndex("affiliate_brand_merchant_provider_unique").on(
            table.merchantId,
            table.provider
        ),
        // A provider brand maps to exactly one internal merchant.
        uniqueIndex("affiliate_brand_provider_external_unique").on(
            table.provider,
            table.externalId
        ),
        // No standalone merchantId index: the (merchantId, provider) unique
        // above already serves merchantId-prefix scans.
    ]
);

/**
 * Attribution source of truth: the opaque `token` (sub-id) Frak mints and hands
 * to a `provider`, mapped to the `(identityGroupId, merchantId)` that earns the
 * reward. Conversions reported by the provider echo this token back.
 *
 * One stable token per `(provider, identityGroupId, merchantId)` keeps link
 * generation idempotent and merge-safe. `trackingLink` / `couponCode` are a
 * re-derivable cache; `metadata` holds provider-specific extras.
 */
export const affiliateAttributionTable = pgTable(
    "affiliate_attribution",
    {
        // Opaque value handed to the provider as its sub-id. Never an internal id.
        token: varchar("token", { length: 64 }).primaryKey(),
        provider: text("provider").$type<AffiliateProvider>().notNull(),
        identityGroupId: uuid("identity_group_id").notNull(),
        merchantId: uuid("merchant_id").notNull(),
        trackingLink: text("tracking_link"),
        couponCode: varchar("coupon_code", { length: 128 }),
        metadata: jsonb("metadata").$type<Record<string, unknown>>(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        // ONE stable token per (provider, user, brand) → idempotent links.
        uniqueIndex("affiliate_attribution_provider_user_brand_unique").on(
            table.provider,
            table.identityGroupId,
            table.merchantId
        ),
        index("affiliate_attribution_merchant_idx").on(table.merchantId),
    ]
);

/**
 * Persisted polling cursor per `(provider, stream)` — e.g. TakeAds
 * `("takeads", "conversions")` holds the max `updatedAt` ingested so far.
 *
 * `watermark` is `timestamptz` (`withTimezone`): it tracks an instant compared
 * against a remote provider's clock, so it must be timezone-anchored rather
 * than rely on the server's local offset — otherwise boundary events can be
 * missed/double-read. Pollers serialise it to a UTC ISO 8601 string.
 */
export const affiliateSyncStateTable = pgTable(
    "affiliate_sync_state",
    {
        provider: text("provider").$type<AffiliateProvider>().notNull(),
        stream: varchar("stream", { length: 64 }).notNull(),
        watermark: timestamp("watermark", { withTimezone: true }),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [primaryKey({ columns: [table.provider, table.stream] })]
);

export type AffiliateBrandSelect = typeof affiliateBrandTable.$inferSelect;
export type AffiliateBrandInsert = typeof affiliateBrandTable.$inferInsert;
export type AffiliateAttributionSelect =
    typeof affiliateAttributionTable.$inferSelect;
export type AffiliateAttributionInsert =
    typeof affiliateAttributionTable.$inferInsert;
export type AffiliateSyncStateSelect =
    typeof affiliateSyncStateTable.$inferSelect;
export type AffiliateSyncStateInsert =
    typeof affiliateSyncStateTable.$inferInsert;
