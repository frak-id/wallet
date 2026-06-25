import {
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

/**
 * Attribution source of truth for TakeAds affiliate links.
 *
 * The opaque `subId` is the only value handed to TakeAds; it is minted and
 * owned by the backend and never carries an internal id. Conversions reported
 * by the TakeAds Stats API echo this `subId` back, which we resolve here to the
 * `(identityGroupId, merchantId)` pair that earns the reward.
 *
 * One stable `subId` per `(identityGroupId, merchantId)` (enforced below) keeps
 * link generation idempotent and survives identity merges. The resolved
 * `trackingLink` / `couponCode` are a re-derivable cache, not the source of
 * truth — the mapping row is.
 */
export const takeadsSubIdMapTable = pgTable(
    "takeads_subid_map",
    {
        // Opaque value handed to TakeAds as `subId` (uuid/nanoid). Never an
        // internal id. TakeAds allows up to 6144 chars; we mint short ids.
        subId: varchar("sub_id", { length: 40 }).primaryKey(),
        identityGroupId: uuid("identity_group_id").notNull(),
        merchantId: uuid("merchant_id").notNull(),
        // Cache of the resolved TakeAds deeplink + coupon (re-derivable).
        trackingLink: text("tracking_link"),
        couponCode: varchar("coupon_code", { length: 128 }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        // ONE stable subId per (user, brand) → idempotent links, merge-safe.
        uniqueIndex("takeads_subid_user_merchant_unique").on(
            table.identityGroupId,
            table.merchantId
        ),
        index("takeads_subid_merchant_idx").on(table.merchantId),
    ]
);

/**
 * Persisted cursor for the TakeAds Stats API polling cron.
 *
 * Keyed by an opaque sync `key` (e.g. "stats_action") so a single row tracks
 * the last processed watermark. `watermark` holds the max `updatedAt` of the
 * actions ingested so far; the next poll queries `updatedAtFrom = watermark`.
 *
 * Stored as `timestamp` (no tz) — the polling cron MUST serialise it to a UTC
 * ISO 8601 string (`.toISOString()`) when passing it as `updatedAtFrom`, or
 * boundary actions can be missed/double-read by the local-offset difference.
 */
export const takeadsSyncStateTable = pgTable("takeads_sync_state", {
    key: varchar("key", { length: 64 }).primaryKey(),
    watermark: timestamp("watermark"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Links an internal merchant (one synthetic brand) to its TakeAds catalog
 * brand. Captured by a platform admin during merchant registration.
 *
 * `takeadsMerchantId` is the matching key: TakeAds Stats actions report this
 * integer id, so ingestion + catalog re-sync resolve back to the internal
 * merchant through here. `trackingLink` is the brand's base affiliate link
 * from the catalog; per-user share links are built by setting the `s` (subId)
 * query param on it — no `/resolve` call needed for brand-level sharing.
 */
export const takeadsMerchantTable = pgTable(
    "takeads_merchant",
    {
        // Internal merchant id (one row per synthetic brand).
        merchantId: uuid("merchant_id").primaryKey(),
        // TakeAds catalog brand id (matches Stats `merchantId`).
        takeadsMerchantId: integer("takeads_merchant_id").notNull(),
        // Base affiliate tracking link; share links set `?s=<subId>` on it.
        trackingLink: text("tracking_link").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        // A TakeAds brand maps to exactly one internal merchant.
        uniqueIndex("takeads_merchant_takeads_id_unique").on(
            table.takeadsMerchantId
        ),
    ]
);
