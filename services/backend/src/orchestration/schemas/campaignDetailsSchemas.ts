import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Schemas for the per-campaign details endpoint
 * (`GET /business/merchant/:merchantId/campaigns/:campaignId/details`).
 *
 * Powers the `CampaignDetailsSheet` on the business dashboard: economic
 * KPIs, CPA breakdown, ambassador stats and the top-ambassador leaderboard.
 *
 * Field names mirror the legacy `campaignDetails.json` mock 1:1 so the
 * frontend type swap is purely a `typeof mock` → `CampaignDetailsResponse`
 * change. Two caveats worth knowing:
 *
 *  1. `cpaBreakdown.segments[].key = 'frak'` is an overlay derived from a
 *     hardcoded `PLATFORM_FEE_PCT` constant — the schema's `RecipientType`
 *     enum has only `referrer` and `referee` so there is no real platform
 *     fee asset_log row to sum.
 *  2. `metaCpa` / `metaEquivalentCost` / `savedVsMeta` / `cheaperPct` use a
 *     static industry benchmark per currency (see `campaignBenchmarks.ts`)
 *     — there is no Meta Ads integration. Numbers are marketing-grade.
 */

/** ISO 4217 currency code (e.g. `"EUR"`) sourced from the modal `purchases.currency_code`. */
const CurrencySchema = t.String();

const EconomicValueSchema = t.Object({
    currency: CurrencySchema,
    /** Total reward spend on this campaign, denominated in `currency`. */
    spend: t.Number(),
    /** Distinct purchase interactions attributed to this campaign. */
    conversions: t.Number(),
    /** `spend / conversions`. `0` when there are no conversions. */
    cpa: t.Number(),
    /** Hardcoded industry-average Meta CPA × `conversions`. */
    metaEquivalentCost: t.Number(),
    /** Industry-average Meta Ads CPA for this currency. */
    metaCpa: t.Number(),
    /** `max(0, metaEquivalentCost − spend)`. */
    savedVsMeta: t.Number(),
    /** `savedVsMeta / metaEquivalentCost`. `0` when Meta cost is zero. */
    cheaperPct: t.Number(),
});

const CpaSegmentKeySchema = t.Union([
    t.Literal("frak"),
    t.Literal("ambassador"),
    t.Literal("referee"),
]);

const CpaSegmentSchema = t.Object({
    key: CpaSegmentKeySchema,
    /** Share of CPA total this segment represents, in [0, 1]. */
    pct: t.Number(),
    /** Per-conversion amount in `currency`. */
    amount: t.Number(),
});

const CpaBreakdownSchema = t.Object({
    currency: CurrencySchema,
    /** Same value as `economicValue.cpa`. */
    total: t.Number(),
    /**
     * Three segments — `frak`, `ambassador`, `referee`. The `frak` segment
     * is an overlay (no `platform` recipient_type exists in the schema),
     * derived from `PLATFORM_FEE_PCT`. Ambassador/referee shares are
     * scaled from real `asset_logs.recipient_type` sums by `(1 - fee)`.
     */
    segments: t.Array(CpaSegmentSchema),
});

const AmbassadorStatsSchema = t.Object({
    /** Distinct ambassador wallets that received a `referrer` reward on this campaign. */
    total: t.Number(),
    /**
     * Ambassador conversion rate: `total / interactingUsers` where
     * `interactingUsers` = distinct identity_groups with ≥1 interaction
     * with the merchant. Reads as "of the merchant's active audience,
     * X% became ambassadors on this campaign".
     *
     * The frontend currently labels this card "Shared at least once",
     * which is a soft misnomer — the real metric is "became a paying
     * ambassador on this campaign". FE copy should follow this redefinition.
     */
    activePct: t.Number(),
    /**
     * Share of unique referees (across all referrers of this campaign)
     * who completed at least one attributed purchase.
     */
    refereesConvertedPct: t.Number(),
});

const TopAmbassadorSchema = t.Object({
    /** EIP-55 checksummed wallet address. */
    wallet: t.Hex(),
    /**
     * Number of referral links this ambassador created with the campaign's
     * merchant. Best-effort campaign attribution — see `activePct` note above.
     */
    shares: t.Number(),
    /** Distinct attributed purchases by referees of this ambassador. */
    sales: t.Number(),
    /** Sum of `purchases.total_price` for those attributed purchases. */
    revenue: t.Number(),
    /** Total reward earnings on this campaign, denominated in `currency`. */
    earned: t.Number(),
});

const EfficiencySchema = t.Object({
    currency: CurrencySchema,
    /** `revenue / spend`. `0` when spend is zero. */
    roi: t.Number(),
    /** `spend / ambassadorStats.total`. `0` when there are no ambassadors. */
    avgReward: t.Number(),
    /** Top ambassador's `revenue / totalRevenue`, in [0, 1]. */
    topPerformerPct: t.Number(),
    /** Wallet of the highest-revenue ambassador, or `0x0…0` when empty. */
    topPerformerWallet: t.Hex(),
});

export const CampaignDetailsResponseSchema = t.Object({
    economicValue: EconomicValueSchema,
    cpaBreakdown: CpaBreakdownSchema,
    ambassadorStats: AmbassadorStatsSchema,
    topAmbassadors: t.Array(TopAmbassadorSchema),
    efficiency: EfficiencySchema,
});

export type CampaignDetailsResponse = Static<
    typeof CampaignDetailsResponseSchema
>;
export type CpaSegmentKey = Static<typeof CpaSegmentKeySchema>;
