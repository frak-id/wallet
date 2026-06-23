import {
    type DateRange,
    type ResolvedWindow,
    resolveWindow,
    toNumber,
} from "@backend-utils";
import {
    and,
    asc,
    between,
    eq,
    inArray,
    isNull,
    type SQL,
    sql,
} from "drizzle-orm";
import { campaignRulesTable } from "../../domain/campaign";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";
import {
    aggregateFunnelSteps,
    buildFunnelSeries,
    type OpenPanelChartFilter,
    openPanelExportClient,
    serieCount,
    seriePreviousCount,
    seriePreviousSum,
    serieSum,
} from "../../infrastructure/integrations/openpanel";
import { db } from "../../infrastructure/persistence/postgres";
import type { PricingRepository } from "../../infrastructure/pricing/PricingRepository";
import type {
    OverviewAccurateKpis,
    OverviewAnalyticsResponse,
    OverviewFunnelStep,
    OverviewFunnels,
    OverviewKpis,
    OverviewSeries,
    OverviewSharing,
    OverviewSharingDeviceBucket,
    OverviewSharingPlatformBucket,
    OverviewStatusBreakdown,
    OverviewSummaryResponse,
    OverviewTopCampaign,
    OverviewWindowQuery,
} from "../schemas/campaignOverviewSchemas";
import {
    pickGranularity,
    surfaceCampaignStatus,
    toIsoString,
} from "./assembly";
import {
    DEVICE_KIND_MAP,
    WALLET_SHARING_SOURCES,
    WEBSITE_SHARING_SOURCES,
    walletFunnelDefinition,
    websiteFunnelDefinition,
} from "./funnelDefinitions";
import { distinctPurchases } from "./queries";
import { buildRewardsExpression, getTokenPrices } from "./rewards";

const TOP_CAMPAIGNS_LIMIT = 10;

// Current event schema (merchant_id, source, sharing_link_*) only exists
// from the Sept-2025 analytics refactor on, so flooring OpenPanel queries
// here is lossless. Critical: a lifetime window resolves `from` to 1970, and
// OpenPanel `/export/charts` zero-fills one bucket per interval across the
// whole span — 1970→now is ~20k daily buckets/series and times out the
// export client. Keep this clamp. Postgres uses the true (unclamped) window.
const OPENPANEL_EVENT_EPOCH = new Date("2025-09-01T00:00:00.000Z");

function clampOpenPanelRange(range: DateRange): DateRange {
    const floorMs = OPENPANEL_EVENT_EPOCH.getTime();
    if (range.from.getTime() >= floorMs) return range;
    // A fully pre-epoch range yields from > to → OpenPanel returns zero,
    // which is correct (no events exist there).
    return { from: new Date(floorMs), to: range.to };
}

type AssetKpiRow = {
    ambassadorsCurrent: string;
    ambassadorsPrevious: string;
    rewardsFiatCurrent: string;
    rewardsFiatPrevious: string;
    purchaseInteractionsCurrent: string;
    purchaseInteractionsPrevious: string;
};

type SharesKpiRow = {
    sharesCurrent: string;
    sharesPrevious: string;
};

type PurchaseKpiRow = {
    revenueCurrent: string;
    revenuePrevious: string;
    purchaseCountCurrent: string;
    purchaseCountPrevious: string;
    currency: string | null;
};

type SeriesRow = {
    // `DATE_TRUNC(...)` is a raw `sql<Date>` expression, so Drizzle has no
    // column metadata to decode it. Depending on the driver path it can
    // surface as either a Date (postgres.js OID parser for timestamptz) or
    // an ISO string (raw text fallback). Type both and normalise in JS.
    bucket: Date | string;
    purchaseCount: string;
    revenue: string;
};

/**
 * Powers the campaigns overview dashboard (two routes):
 *
 *  - `GET /business/merchant/:merchantId/campaigns/overview/summary` —
 *    `getSummary` reads cheap Postgres-only KPIs, top campaigns, status
 *    breakdown and bucketed revenue series for the current+previous
 *    window pair.
 *  - `GET /business/merchant/:merchantId/campaigns/overview/analytics` —
 *    `getAnalytics` reads OpenPanel funnels + sharing breakdowns + a
 *    small PG `interaction_logs` tail for the conversion funnel ending.
 *
 * Frontend renders the summary first (immediate), then swaps in the
 * accurate OpenPanel KPIs and funnels when analytics resolves. Both
 * routes share the same window contract and live on the same FE page
 * which is why they share a class.
 */
export class CampaignOverviewOrchestrator {
    constructor(private readonly pricingRepository: PricingRepository) {}

    // -------------------------------------------------------------------
    //  Public — summary (Postgres only)
    // -------------------------------------------------------------------

    async getSummary(
        merchantId: string,
        window: OverviewWindowQuery,
        currency?: string
    ): Promise<OverviewSummaryResponse> {
        const resolved = resolveWindow(window);

        const tokenPrices = await getTokenPrices(
            this.pricingRepository,
            eq(assetLogsTable.merchantId, merchantId),
            currency
        );
        const fiatRewardsExpr = buildRewardsExpression(tokenPrices);

        const [kpis, topAndStatus, series] = await Promise.all([
            this.getKpis(merchantId, resolved, fiatRewardsExpr),
            this.getTopCampaignsAndStatusBreakdown(
                merchantId,
                resolved.current
            ),
            this.getSeries(merchantId, resolved.current),
        ]);

        return {
            kpis,
            topCampaigns: topAndStatus.topCampaigns,
            statusBreakdown: topAndStatus.statusBreakdown,
            series,
        };
    }

    /**
     * Three parallel scans. `asset_logs` (joined to `interaction_logs`
     * for the `purchase` filter) and `interaction_logs` (for shares)
     * compute current+previous via `FILTER (WHERE …)` aggregates so we
     * read each source table exactly once. Revenue is fetched
     * separately by `getRevenueKpis` over the shared `distinctPurchases`
     * subquery.
     */
    private async getKpis(
        merchantId: string,
        resolved: ResolvedWindow,
        fiatRewardsExpr: SQL
    ): Promise<OverviewKpis> {
        const { current, previous } = resolved;
        const outerFrom = previous.from;
        const outerTo = current.to;

        const [assetRows, sharesRows, purchaseRow] = await Promise.all([
            db
                .select({
                    ambassadorsCurrent: sql<string>`COUNT(DISTINCT ${assetLogsTable.identityGroupId}) FILTER (WHERE ${assetLogsTable.recipientType} = 'referrer' AND ${between(assetLogsTable.createdAt, current.from, current.to)})`,
                    ambassadorsPrevious: sql<string>`COUNT(DISTINCT ${assetLogsTable.identityGroupId}) FILTER (WHERE ${assetLogsTable.recipientType} = 'referrer' AND ${between(assetLogsTable.createdAt, previous.from, previous.to)})`,
                    rewardsFiatCurrent: sql<string>`COALESCE(SUM(${fiatRewardsExpr}) FILTER (WHERE ${between(assetLogsTable.createdAt, current.from, current.to)}), 0)`,
                    rewardsFiatPrevious: sql<string>`COALESCE(SUM(${fiatRewardsExpr}) FILTER (WHERE ${between(assetLogsTable.createdAt, previous.from, previous.to)}), 0)`,
                    purchaseInteractionsCurrent: sql<string>`COUNT(DISTINCT ${interactionLogsTable.id}) FILTER (WHERE ${interactionLogsTable.type} = 'purchase' AND ${between(assetLogsTable.createdAt, current.from, current.to)})`,
                    purchaseInteractionsPrevious: sql<string>`COUNT(DISTINCT ${interactionLogsTable.id}) FILTER (WHERE ${interactionLogsTable.type} = 'purchase' AND ${between(assetLogsTable.createdAt, previous.from, previous.to)})`,
                })
                .from(assetLogsTable)
                .leftJoin(
                    interactionLogsTable,
                    eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
                )
                .where(
                    and(
                        eq(assetLogsTable.merchantId, merchantId),
                        isNull(assetLogsTable.cancelledAt),
                        between(assetLogsTable.createdAt, outerFrom, outerTo)
                    )
                ),
            db
                .select({
                    sharesCurrent: sql<string>`COUNT(*) FILTER (WHERE ${between(interactionLogsTable.createdAt, current.from, current.to)})`,
                    sharesPrevious: sql<string>`COUNT(*) FILTER (WHERE ${between(interactionLogsTable.createdAt, previous.from, previous.to)})`,
                })
                .from(interactionLogsTable)
                .where(
                    and(
                        eq(interactionLogsTable.merchantId, merchantId),
                        eq(interactionLogsTable.type, "create_referral_link"),
                        isNull(interactionLogsTable.cancelledAt),
                        between(
                            interactionLogsTable.createdAt,
                            outerFrom,
                            outerTo
                        )
                    )
                ),
            this.getRevenueKpis(merchantId, resolved),
        ]);

        const assetRow = (assetRows[0] ?? {}) as Partial<AssetKpiRow>;
        const sharesRow = (sharesRows[0] ?? {}) as Partial<SharesKpiRow>;

        return {
            ambassadors: {
                current: toNumber(assetRow.ambassadorsCurrent),
                previous: toNumber(assetRow.ambassadorsPrevious),
            },
            shares: {
                current: toNumber(sharesRow.sharesCurrent),
                previous: toNumber(sharesRow.sharesPrevious),
            },
            revenue: {
                current: toNumber(purchaseRow.revenueCurrent),
                previous: toNumber(purchaseRow.revenuePrevious),
                currency: purchaseRow.currency ?? null,
            },
            totalRewardsFiat: {
                current: toNumber(assetRow.rewardsFiatCurrent),
                previous: toNumber(assetRow.rewardsFiatPrevious),
            },
            purchaseCount: {
                current: toNumber(purchaseRow.purchaseCountCurrent),
                previous: toNumber(purchaseRow.purchaseCountPrevious),
            },
        };
    }

    /**
     * Revenue + purchase count + currency for both halves of the
     * window. Reads `interaction_logs.payload.amount` over purchases
     * reachable through an un-cancelled `asset_logs` row on this
     * merchant. Uses the shared `distinctPurchases` CTE so
     * multi-recipient rewards don't inflate the basket sum or purchase
     * count.
     */
    private async getRevenueKpis(
        merchantId: string,
        resolved: ResolvedWindow
    ): Promise<Partial<PurchaseKpiRow>> {
        const { current, previous } = resolved;
        const outerFrom = previous.from;
        const outerTo = current.to;

        const purchases = distinctPurchases([
            eq(assetLogsTable.merchantId, merchantId),
            between(interactionLogsTable.createdAt, outerFrom, outerTo),
        ]);

        const [row] = await db
            .select({
                revenueCurrent: sql<string>`COALESCE(SUM(${purchases.amount}) FILTER (WHERE ${between(purchases.createdAt, current.from, current.to)}), 0)`,
                revenuePrevious: sql<string>`COALESCE(SUM(${purchases.amount}) FILTER (WHERE ${between(purchases.createdAt, previous.from, previous.to)}), 0)`,
                purchaseCountCurrent: sql<string>`COUNT(*) FILTER (WHERE ${between(purchases.createdAt, current.from, current.to)})`,
                purchaseCountPrevious: sql<string>`COUNT(*) FILTER (WHERE ${between(purchases.createdAt, previous.from, previous.to)})`,
                // MODE() returns the most-frequent currency in the
                // current window. Mixed-currency merchants are rare;
                // we surface the modal value so the FE's SUM display
                // matches the predominant unit.
                currency: sql<
                    string | null
                >`MODE() WITHIN GROUP (ORDER BY ${purchases.currency}) FILTER (WHERE ${between(purchases.createdAt, current.from, current.to)})`,
            })
            .from(purchases);

        return row ?? {};
    }

    private async getTopCampaignsAndStatusBreakdown(
        merchantId: string,
        range: DateRange
    ): Promise<{
        topCampaigns: OverviewTopCampaign[];
        statusBreakdown: OverviewStatusBreakdown;
    }> {
        const campaigns = await db
            .select({
                id: campaignRulesTable.id,
                name: campaignRulesTable.name,
                status: campaignRulesTable.status,
                expiresAt: campaignRulesTable.expiresAt,
            })
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.merchantId, merchantId));

        if (campaigns.length === 0) {
            return {
                topCampaigns: [],
                statusBreakdown: { active: 0, paused: 0, draft: 0, ended: 0 },
            };
        }

        const now = new Date();
        const surfacedStatus = new Map<string, OverviewTopCampaign["status"]>(
            campaigns.map((c) => [
                c.id,
                surfaceCampaignStatus(c.status, c.expiresAt, now),
            ])
        );

        const statusBreakdown: OverviewStatusBreakdown = {
            active: 0,
            paused: 0,
            draft: 0,
            ended: 0,
        };
        for (const status of surfacedStatus.values()) {
            statusBreakdown[status] += 1;
        }

        const campaignIds = campaigns.map((c) => c.id);
        const rewardsCounts = await this.getRewardsCountByCampaign(
            campaignIds,
            range
        );

        const topCampaigns: OverviewTopCampaign[] = campaigns
            .map((c) => ({
                id: c.id,
                name: c.name,
                status: surfacedStatus.get(c.id) ?? "ended",
                rewardsCount: rewardsCounts.get(c.id) ?? 0,
            }))
            .sort((a, b) => b.rewardsCount - a.rewardsCount)
            .slice(0, TOP_CAMPAIGNS_LIMIT);

        return { topCampaigns, statusBreakdown };
    }

    /**
     * Per-campaign reward count — counts un-cancelled `asset_logs` rows
     * scoped to each campaign rule within the current window.
     */
    private async getRewardsCountByCampaign(
        campaignIds: string[],
        range: DateRange
    ): Promise<Map<string, number>> {
        if (campaignIds.length === 0) return new Map();

        const rows = await db
            .select({
                campaignRuleId: assetLogsTable.campaignRuleId,
                rewardsCount: sql<number>`COUNT(*)`,
            })
            .from(assetLogsTable)
            .where(
                and(
                    inArray(assetLogsTable.campaignRuleId, campaignIds),
                    isNull(assetLogsTable.cancelledAt),
                    between(assetLogsTable.createdAt, range.from, range.to)
                )
            )
            .groupBy(assetLogsTable.campaignRuleId);

        const result = new Map<string, number>();
        for (const row of rows) {
            if (!row.campaignRuleId) continue;
            result.set(row.campaignRuleId, toNumber(row.rewardsCount));
        }
        return result;
    }

    /**
     * Bucketed attributed-purchases + revenue series. Same data source
     * as `getRevenueKpis` — the chart and KPI cards read identical
     * numbers.
     */
    private async getSeries(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewSeries> {
        const granularity = pickGranularity(range);

        const purchases = distinctPurchases([
            eq(assetLogsTable.merchantId, merchantId),
            between(interactionLogsTable.createdAt, range.from, range.to),
        ]);

        const bucketExpr = sql`DATE_TRUNC(${granularity}, ${purchases.createdAt})`;

        const rows = await db
            .select({
                bucket: sql<Date>`${bucketExpr}`.as("bucket"),
                purchaseCount: sql<string>`COUNT(*)`,
                revenue: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
            })
            .from(purchases)
            .groupBy(sql`bucket`)
            .orderBy(asc(sql`bucket`));

        const buckets = (rows as SeriesRow[]).map((row) => ({
            bucket: toIsoString(row.bucket),
            purchaseCount: toNumber(row.purchaseCount),
            revenue: toNumber(row.revenue),
        }));

        return { granularity, buckets };
    }

    // -------------------------------------------------------------------
    //  Public — analytics (OpenPanel + PG tail)
    // -------------------------------------------------------------------

    async getAnalytics(
        merchantId: string,
        window: OverviewWindowQuery
    ): Promise<OverviewAnalyticsResponse> {
        const resolved = resolveWindow(window);
        const withPrevious = resolved.hasComparison;
        const openPanelRange = clampOpenPanelRange(resolved.current);

        const [
            websiteSteps,
            walletSteps,
            accurateKpis,
            platform,
            device,
            tail,
        ] = await Promise.all([
            this.runFunnel(
                merchantId,
                websiteFunnelDefinition(),
                openPanelRange,
                withPrevious
            ),
            this.runFunnel(
                merchantId,
                walletFunnelDefinition(),
                openPanelRange,
                withPrevious
            ),
            this.getAccurateKpis(merchantId, openPanelRange, withPrevious),
            this.getSharingPlatform(merchantId, openPanelRange),
            this.getSharingDevice(merchantId, openPanelRange),
            this.getBackendFunnelTail(merchantId, resolved),
        ]);

        const funnels: OverviewFunnels = {
            website: [...websiteSteps, ...tail],
            wallet: [...walletSteps, ...tail],
        };
        const sharing: OverviewSharing = { platform, device };

        return { funnels, sharing, accurateKpis };
    }

    /** Scope every OpenPanel chart request to a single merchant. */
    private merchantFilter(merchantId: string): OpenPanelChartFilter {
        return {
            name: "properties.merchant_id",
            operator: "is",
            value: [merchantId],
        };
    }

    private async runFunnel(
        merchantId: string,
        definitions: ReturnType<typeof websiteFunnelDefinition>,
        range: DateRange,
        withPrevious: boolean
    ): Promise<OverviewFunnelStep[]> {
        const merchantFilter = this.merchantFilter(merchantId);
        const response = await openPanelExportClient.getChart({
            series: buildFunnelSeries(definitions, [merchantFilter]),
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            range: "custom",
            interval: "month",
            previous: withPrevious,
        });
        return aggregateFunnelSteps(definitions, response.series);
    }

    /**
     * Accurate `shares` + `ambassadors` from one OpenPanel series spanning
     * both share events. `metrics.sum` (default event segment) is the total
     * share count; `metrics.count` is `uniq(profile_id)` over the whole
     * range — a true distinct-ambassador count that de-duplicates profiles
     * across both buckets and events, unlike a per-bucket user-segment sum.
     * `previous.*` feeds the FE delta chips.
     */
    private async getAccurateKpis(
        merchantId: string,
        range: DateRange,
        withPrevious: boolean
    ): Promise<OverviewAccurateKpis> {
        const response = await openPanelExportClient.getChart({
            series: [
                {
                    name: "*",
                    filters: [
                        this.merchantFilter(merchantId),
                        {
                            name: "name",
                            operator: "is",
                            value: [
                                "sharing_link_shared",
                                "sharing_link_copied",
                            ],
                        },
                    ],
                },
            ],
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            range: "custom",
            interval: "month",
            previous: withPrevious,
        });
        const serie = response.series[0];
        return {
            shares: {
                current: serieSum(serie),
                previous: seriePreviousSum(serie),
            },
            ambassadors: {
                current: serieCount(serie),
                previous: seriePreviousCount(serie),
            },
        };
    }

    private async getSharingPlatform(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewSharingPlatformBucket[]> {
        const totals = await this.getSharingBreakdown(
            merchantId,
            range,
            "properties.source"
        );

        let walletApp = 0;
        let merchantSite = 0;
        for (const [source, value] of totals) {
            if (WALLET_SHARING_SOURCES.includes(source)) {
                walletApp += value;
            } else if (WEBSITE_SHARING_SOURCES.includes(source)) {
                merchantSite += value;
            }
        }

        return [
            { kind: "merchant_site", value: merchantSite },
            { kind: "wallet_app", value: walletApp },
        ];
    }

    private async getSharingDevice(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewSharingDeviceBucket[]> {
        const totals = await this.getSharingBreakdown(
            merchantId,
            range,
            "device"
        );

        const byKind = new Map<OverviewSharingDeviceBucket["kind"], number>();
        for (const [source, value] of totals) {
            const kind = DEVICE_KIND_MAP[source] ?? "other";
            byKind.set(kind, (byKind.get(kind) ?? 0) + value);
        }

        return Array.from(byKind, ([kind, value]) => ({ kind, value })).sort(
            (a, b) => b.value - a.value
        );
    }

    private async getSharingBreakdown(
        merchantId: string,
        range: DateRange,
        breakdown: string
    ): Promise<Map<string, number>> {
        const merchantFilter = this.merchantFilter(merchantId);
        const response = await openPanelExportClient.getChart({
            series: [
                { name: "sharing_link_shared", filters: [merchantFilter] },
                { name: "sharing_link_copied", filters: [merchantFilter] },
            ],
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            range: "custom",
            interval: "month",
            breakdowns: [{ name: breakdown }],
        });

        const totals = new Map<string, number>();
        for (const serie of response.series) {
            const value = serie.event.breakdowns?.[breakdown] ?? "unknown";
            totals.set(value, (totals.get(value) ?? 0) + serieSum(serie));
        }
        return totals;
    }

    private async getBackendFunnelTail(
        merchantId: string,
        resolved: ResolvedWindow
    ): Promise<OverviewFunnelStep[]> {
        // Backend can't tell whether a referral came from the wallet or the
        // partner site — both funnels reuse the same tail. Revisit when
        // referral_links grow a `source` column.
        const { current, previous } = resolved;
        const createdAt = interactionLogsTable.createdAt;
        const type = interactionLogsTable.type;
        const rows = await db
            .select({
                referredCurrent: sql<number>`COUNT(*) FILTER (WHERE ${type} = 'referral_arrival' AND ${between(createdAt, current.from, current.to)})`,
                referredPrevious: sql<number>`COUNT(*) FILTER (WHERE ${type} = 'referral_arrival' AND ${between(createdAt, previous.from, previous.to)})`,
                convertedCurrent: sql<number>`COUNT(*) FILTER (WHERE ${type} = 'purchase' AND ${between(createdAt, current.from, current.to)})`,
                convertedPrevious: sql<number>`COUNT(*) FILTER (WHERE ${type} = 'purchase' AND ${between(createdAt, previous.from, previous.to)})`,
            })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.merchantId, merchantId),
                    isNull(interactionLogsTable.cancelledAt),
                    between(createdAt, previous.from, current.to)
                )
            );

        const row = rows[0];
        return [
            {
                kind: "referred",
                value: toNumber(row?.referredCurrent),
                previousValue: toNumber(row?.referredPrevious),
            },
            {
                kind: "converted",
                value: toNumber(row?.convertedCurrent),
                previousValue: toNumber(row?.convertedPrevious),
            },
        ];
    }
}
