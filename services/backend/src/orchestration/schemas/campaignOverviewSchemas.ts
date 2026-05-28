import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Schemas for the campaigns overview dashboard endpoint
 * (`GET /business/merchant/:merchantId/campaigns/overview/summary`).
 *
 * The shape mirrors `apps/business/src/mock/campaignsOverview.json` so the
 * frontend cards can switch from mock to real data without touching their
 * rendering code. Sections sourced from Postgres only live here; funnels +
 * sharing breakdowns will land in a sibling `OverviewAnalyticsSchema` once
 * the OpenPanel integration ships (see `docs/campaigns-overview-endpoint.md`).
 */

const KpiValueSchema = t.Object({
    value: t.Number(),
    delta: t.Optional(t.Number()),
});
export type KpiValue = Static<typeof KpiValueSchema>;

export const OverviewKpisSchema = t.Object({
    ambassadors: KpiValueSchema,
    shares: KpiValueSchema,
    revenue: KpiValueSchema,
    sharingRate: KpiValueSchema,
    avgCpa: KpiValueSchema,
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

export const OverviewPurchasesSchema = t.Object({
    total: t.Number(),
    avgPerMonth: t.Number(),
    series: t.Array(
        t.Object({
            label: t.String(),
            value: t.Number(),
        })
    ),
});
export type OverviewPurchases = Static<typeof OverviewPurchasesSchema>;

export const OverviewProjectedRevenueSchema = t.Object({
    total: t.Number(),
    series: t.Array(
        t.Object({
            label: t.String(),
            actual: t.Optional(t.Number()),
            forecast: t.Optional(t.Number()),
        })
    ),
});
export type OverviewProjectedRevenue = Static<
    typeof OverviewProjectedRevenueSchema
>;

export const OverviewSummaryResponseSchema = t.Object({
    kpis: OverviewKpisSchema,
    topCampaigns: t.Array(OverviewTopCampaignSchema),
    statusBreakdown: OverviewStatusBreakdownSchema,
    purchases: OverviewPurchasesSchema,
    projectedRevenue: OverviewProjectedRevenueSchema,
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
