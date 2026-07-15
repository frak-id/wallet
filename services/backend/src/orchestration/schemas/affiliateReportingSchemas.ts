import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Schemas for the platform-admin affiliate reporting endpoint
 * (`GET /business/merchant/:merchantId/affiliate/reporting`).
 *
 * The report is fetched on-demand from the TakeAds Stats API (source of
 * truth) rather than stored: it's an admin-only, low-frequency view, so we
 * trade a little latency for zero storage/ingestion surface. The contract is
 * raw counts + ISO/`yyyy-MM-dd` dates; the dashboard owns all localisation.
 *
 * Money is never summed across currencies — action revenue is returned as a
 * per-currency array, and the time series carry counts only.
 */

/** Optional `yyyy-MM-dd` window; omitting both defaults to the last 30 days. */
export const AffiliateReportingQuerySchema = t.Object({
    from: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
    to: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
});
export type AffiliateReportingQuery = Static<
    typeof AffiliateReportingQuerySchema
>;

/** Action counts per lifecycle status. */
const AffiliateActionStatusBreakdownSchema = t.Object({
    pending: t.Number(),
    confirmed: t.Number(),
    canceled: t.Number(),
    settled: t.Number(),
});
export type AffiliateActionStatusBreakdown = Static<
    typeof AffiliateActionStatusBreakdownSchema
>;

/** Action counts per pricing model. */
const AffiliateActionTypeBreakdownSchema = t.Object({
    lead: t.Number(),
    sale: t.Number(),
    click: t.Number(),
    bonus: t.Number(),
});
export type AffiliateActionTypeBreakdown = Static<
    typeof AffiliateActionTypeBreakdownSchema
>;

/** Order + commission totals for a single currency. */
const AffiliateRevenueByCurrencySchema = t.Object({
    currencyCode: t.String(),
    orderAmount: t.Number(),
    publisherRevenue: t.Number(),
});
export type AffiliateRevenueByCurrency = Static<
    typeof AffiliateRevenueByCurrencySchema
>;

/** One `yyyy-MM-dd` bucket of a daily count series. */
const AffiliateDailyCountSchema = t.Object({
    date: t.String(),
    count: t.Number(),
});
export type AffiliateDailyCount = Static<typeof AffiliateDailyCountSchema>;

const AffiliateActionsReportSchema = t.Object({
    total: t.Number(),
    byStatus: AffiliateActionStatusBreakdownSchema,
    byType: AffiliateActionTypeBreakdownSchema,
    revenue: t.Array(AffiliateRevenueByCurrencySchema),
    series: t.Array(AffiliateDailyCountSchema),
    /** True when the page cap was hit and the totals are a lower bound. */
    truncated: t.Boolean(),
});
export type AffiliateActionsReport = Static<
    typeof AffiliateActionsReportSchema
>;

const AffiliateClicksReportSchema = t.Object({
    total: t.Number(),
    series: t.Array(AffiliateDailyCountSchema),
    /** True when the page cap was hit and the totals are a lower bound. */
    truncated: t.Boolean(),
});
export type AffiliateClicksReport = Static<typeof AffiliateClicksReportSchema>;

export const AffiliateReportingResponseSchema = t.Object({
    brand: t.Object({
        provider: t.Literal("takeads"),
        externalId: t.String(),
        trackingLink: t.String(),
    }),
    window: t.Object({ from: t.String(), to: t.String() }),
    actions: AffiliateActionsReportSchema,
    clicks: AffiliateClicksReportSchema,
});
export type AffiliateReportingResponse = Static<
    typeof AffiliateReportingResponseSchema
>;
