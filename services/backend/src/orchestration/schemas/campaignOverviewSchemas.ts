import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Schemas for the campaigns overview dashboard endpoint
 * (`GET /business/merchant/:merchantId/campaigns/overview/summary` and
 * `.../overview/analytics`).
 *
 * Contract is intentionally raw-numbers + ISO-dates. The business
 * dashboard derives:
 *   - deltas (`(current - previous) / previous`)
 *   - sharing rate, avg CPA (ratios of KPIs)
 *   - localised currency / date labels (`Intl.NumberFormat`,
 *     `Intl.DateTimeFormat`)
 *   - revenue forecast (linear extrapolation in the chart)
 * Keeping these on the client lets us i18n correctly, drop precision-loss
 * rounding, and keep the response cacheable (no `now()`-dependent fields).
 */

/** Window-comparable scalar KPI (counts, USD amounts). */
const NumericKpiSchema = t.Object({
    current: t.Number(),
    previous: t.Number(),
});
export type NumericKpi = Static<typeof NumericKpiSchema>;

/**
 * Revenue KPI carries the merchant's purchase currency so the frontend
 * can format with `Intl.NumberFormat`. `currency` is the modal currency
 * code observed in the current window's purchases (or `null` when the
 * window has no purchases — frontend falls back to merchant settings).
 */
const RevenueKpiSchema = t.Object({
    current: t.Number(),
    previous: t.Number(),
    currency: t.Union([t.String(), t.Null()]),
});
export type RevenueKpi = Static<typeof RevenueKpiSchema>;

export const OverviewKpisSchema = t.Object({
    ambassadors: NumericKpiSchema,
    shares: NumericKpiSchema,
    revenue: RevenueKpiSchema,
    totalRewardsUsd: NumericKpiSchema,
    purchaseCount: NumericKpiSchema,
});
export type OverviewKpis = Static<typeof OverviewKpisSchema>;

/**
 * Frontend-facing campaign status. `archived` campaigns and `active`
 * campaigns past their `expires_at` are surfaced as `ended` so the
 * dashboard legend matches the existing mock vocabulary.
 */
export const OverviewCampaignStatusSchema = t.Union([
    t.Literal("active"),
    t.Literal("paused"),
    t.Literal("draft"),
    t.Literal("ended"),
]);
export type OverviewCampaignStatus = Static<
    typeof OverviewCampaignStatusSchema
>;

export const OverviewTopCampaignSchema = t.Object({
    id: t.String(),
    name: t.String(),
    status: OverviewCampaignStatusSchema,
    rewardsCount: t.Number(),
});
export type OverviewTopCampaign = Static<typeof OverviewTopCampaignSchema>;

export const OverviewStatusBreakdownSchema = t.Object({
    active: t.Number(),
    paused: t.Number(),
    draft: t.Number(),
    ended: t.Number(),
});
export type OverviewStatusBreakdown = Static<
    typeof OverviewStatusBreakdownSchema
>;

/** Bucketing granularity — backend picks day vs month from window width. */
export const OverviewGranularitySchema = t.Union([
    t.Literal("day"),
    t.Literal("month"),
]);
export type OverviewGranularity = Static<typeof OverviewGranularitySchema>;

/**
 * One bucket on the purchases/revenue time series. `bucket` is the
 * UTC-truncated boundary as an ISO 8601 string — frontend formats with
 * `Intl.DateTimeFormat(locale)` and projects forecasts from `revenue`.
 */
const OverviewSeriesBucketSchema = t.Object({
    bucket: t.String({ format: "date-time" }),
    purchaseCount: t.Number(),
    revenue: t.Number(),
});
export type OverviewSeriesBucket = Static<typeof OverviewSeriesBucketSchema>;

export const OverviewSeriesSchema = t.Object({
    granularity: OverviewGranularitySchema,
    buckets: t.Array(OverviewSeriesBucketSchema),
});
export type OverviewSeries = Static<typeof OverviewSeriesSchema>;

export const OverviewSummaryResponseSchema = t.Object({
    kpis: OverviewKpisSchema,
    topCampaigns: t.Array(OverviewTopCampaignSchema),
    statusBreakdown: OverviewStatusBreakdownSchema,
    series: OverviewSeriesSchema,
});
export type OverviewSummaryResponse = Static<
    typeof OverviewSummaryResponseSchema
>;

const OverviewFunnelStepSchema = t.Object({
    label: t.String(),
    value: t.Number(),
    delta: t.Optional(t.Number()),
});
export type OverviewFunnelStep = Static<typeof OverviewFunnelStepSchema>;

export const OverviewFunnelsSchema = t.Object({
    website: t.Array(OverviewFunnelStepSchema),
    wallet: t.Array(OverviewFunnelStepSchema),
});
export type OverviewFunnels = Static<typeof OverviewFunnelsSchema>;

const OverviewSharingBucketSchema = t.Object({
    label: t.String(),
    value: t.Number(),
});
export type OverviewSharingBucket = Static<typeof OverviewSharingBucketSchema>;

export const OverviewSharingSchema = t.Object({
    platform: t.Array(OverviewSharingBucketSchema),
    device: t.Array(OverviewSharingBucketSchema),
});
export type OverviewSharing = Static<typeof OverviewSharingSchema>;

export const OverviewAnalyticsResponseSchema = t.Object({
    funnels: OverviewFunnelsSchema,
    sharing: OverviewSharingSchema,
});
export type OverviewAnalyticsResponse = Static<
    typeof OverviewAnalyticsResponseSchema
>;

/**
 * Query parameters accepted by overview endpoints. Both bounds are optional
 * ISO `yyyy-MM-dd` strings; the orchestrator falls back to a trailing
 * 30-day window when either is absent.
 */
export const OverviewWindowQuerySchema = t.Object({
    from: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
    to: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
});
export type OverviewWindowQuery = Static<typeof OverviewWindowQuerySchema>;
