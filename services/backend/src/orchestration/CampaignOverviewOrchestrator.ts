import {
    and,
    asc,
    between,
    count,
    countDistinct,
    eq,
    inArray,
    isNull,
    type SQL,
    sql,
} from "drizzle-orm";
import { type Address, getAddress } from "viem";
import { campaignRulesTable } from "../domain/campaign/db/schema";
import type { CampaignStatus } from "../domain/campaign/schemas";
import {
    merchantWebhooksTable,
    purchasesTable,
} from "../domain/purchases/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../domain/rewards/db/schema";
import { db } from "../infrastructure/persistence/postgres";
import type { PricingRepository } from "../infrastructure/pricing/PricingRepository";
import type {
    OverviewKpis,
    OverviewProjectedRevenue,
    OverviewPurchases,
    OverviewStatusBreakdown,
    OverviewSummaryResponse,
    OverviewTopCampaign,
    OverviewWindowQuery,
} from "./schemas/campaignOverviewSchemas";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;
const TOP_CAMPAIGNS_LIMIT = 10;
/** Switch from daily to monthly bucketing once the window spans this many days. */
const MONTHLY_BUCKET_THRESHOLD_DAYS = 60;
const MAX_BUCKETS = 12;
const FORECAST_BUCKETS = 2;
const FORECAST_LOOKBACK = 3;

type DateRange = { from: Date; to: Date };
type ResolvedWindow = { current: DateRange; previous: DateRange };

type TokenPriceMap = Map<string, number>;

type KpiAggregates = {
    ambassadors: number;
    shares: number;
    revenue: number;
    purchaseInteractions: number;
    totalRewardsUsd: number;
};

type PurchasesBucketRow = { bucket: Date; value: number };
type RevenueBucketRow = { bucket: Date; value: string };

/**
 * Aggregates the "campaigns overview" dashboard summary from Postgres only.
 * OpenPanel-backed funnels and sharing breakdowns are handled by a sibling
 * `CampaignAnalyticsOrchestrator` (Phase 3).
 *
 * All KPIs are scoped to a date window (defaulting to a trailing 30 days);
 * deltas are computed against the same-length window immediately preceding
 * the current one.
 */
export class CampaignOverviewOrchestrator {
    constructor(private readonly pricingRepository: PricingRepository) {}

    async getSummary(
        merchantId: string,
        window: OverviewWindowQuery
    ): Promise<OverviewSummaryResponse> {
        const resolved = resolveWindow(window);

        // Token prices are reused across the KPI + projected-revenue queries
        // — fetch them once and pass the SQL expression down.
        const tokenPrices = await this.getTokenPricesForMerchant(merchantId);
        const usdRewardsExpr = buildUsdRewardsExpression(tokenPrices);

        const [kpis, topAndStatus, purchases, projectedRevenue] =
            await Promise.all([
                this.getKpis(merchantId, resolved, usdRewardsExpr),
                this.getTopCampaignsAndStatusBreakdown(
                    merchantId,
                    resolved.current
                ),
                this.getPurchases(merchantId, resolved.current),
                this.getProjectedRevenue(merchantId, resolved.current),
            ]);

        return {
            kpis,
            topCampaigns: topAndStatus.topCampaigns,
            statusBreakdown: topAndStatus.statusBreakdown,
            purchases,
            projectedRevenue,
        };
    }

    private async getKpis(
        merchantId: string,
        resolved: ResolvedWindow,
        usdRewardsExpr: SQL
    ): Promise<OverviewKpis> {
        const [current, previous] = await Promise.all([
            this.aggregateKpis(merchantId, resolved.current, usdRewardsExpr),
            this.aggregateKpis(merchantId, resolved.previous, usdRewardsExpr),
        ]);

        const sharingRateCurrent = safeRatio(
            current.shares,
            current.ambassadors
        );
        const sharingRatePrevious = safeRatio(
            previous.shares,
            previous.ambassadors
        );

        return {
            ambassadors: {
                value: current.ambassadors,
                delta: percentDelta(current.ambassadors, previous.ambassadors),
            },
            shares: {
                value: current.shares,
                delta: percentDelta(current.shares, previous.shares),
            },
            revenue: {
                value: round2(current.revenue),
                delta: percentDelta(current.revenue, previous.revenue),
            },
            sharingRate: {
                value: round3(sharingRateCurrent),
                delta: percentDelta(sharingRateCurrent, sharingRatePrevious),
            },
            avgCpa: {
                // No delta on avgCpa — matches the existing mock contract.
                value: round2(
                    safeRatio(
                        current.totalRewardsUsd,
                        current.purchaseInteractions
                    )
                ),
            },
        };
    }

    private async aggregateKpis(
        merchantId: string,
        range: DateRange,
        usdRewardsExpr: SQL
    ): Promise<KpiAggregates> {
        const [ambassadorsRow, sharesRow, revenueRow, rewardsRow] =
            await Promise.all([
                db
                    .select({
                        value: countDistinct(assetLogsTable.identityGroupId),
                    })
                    .from(assetLogsTable)
                    .where(
                        and(
                            eq(assetLogsTable.merchantId, merchantId),
                            eq(assetLogsTable.recipientType, "referrer"),
                            isNull(assetLogsTable.cancelledAt),
                            between(
                                assetLogsTable.createdAt,
                                range.from,
                                range.to
                            )
                        )
                    ),
                db
                    .select({ value: count() })
                    .from(interactionLogsTable)
                    .where(
                        and(
                            eq(interactionLogsTable.merchantId, merchantId),
                            eq(
                                interactionLogsTable.type,
                                "create_referral_link"
                            ),
                            isNull(interactionLogsTable.cancelledAt),
                            between(
                                interactionLogsTable.createdAt,
                                range.from,
                                range.to
                            )
                        )
                    ),
                db
                    .select({
                        value: sql<string>`COALESCE(SUM(${purchasesTable.totalPrice}::NUMERIC), 0)`,
                    })
                    .from(purchasesTable)
                    .innerJoin(
                        merchantWebhooksTable,
                        eq(merchantWebhooksTable.id, purchasesTable.webhookId)
                    )
                    .where(
                        and(
                            eq(merchantWebhooksTable.merchantId, merchantId),
                            between(
                                purchasesTable.createdAt,
                                range.from,
                                range.to
                            )
                        )
                    ),
                db
                    .select({
                        totalRewardsUsd: sql<string>`COALESCE(SUM(${usdRewardsExpr}), 0)`,
                        purchaseInteractions: sql<number>`COUNT(DISTINCT CASE WHEN ${interactionLogsTable.type} = 'purchase' THEN ${interactionLogsTable.id} END)`,
                    })
                    .from(assetLogsTable)
                    .leftJoin(
                        interactionLogsTable,
                        eq(
                            assetLogsTable.interactionLogId,
                            interactionLogsTable.id
                        )
                    )
                    .where(
                        and(
                            eq(assetLogsTable.merchantId, merchantId),
                            isNull(assetLogsTable.cancelledAt),
                            between(
                                assetLogsTable.createdAt,
                                range.from,
                                range.to
                            )
                        )
                    ),
            ]);

        return {
            ambassadors: Number(ambassadorsRow[0]?.value ?? 0),
            shares: Number(sharesRow[0]?.value ?? 0),
            revenue: Number(revenueRow[0]?.value ?? 0),
            totalRewardsUsd: Number(rewardsRow[0]?.totalRewardsUsd ?? 0),
            purchaseInteractions: Number(
                rewardsRow[0]?.purchaseInteractions ?? 0
            ),
        };
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
     * scoped to each campaign rule within the current window. Replaces
     * the legacy "sharing rate" metric: `create_referral_link` is
     * merchant-scoped (one row per share), so attributing it to a
     * specific campaign rule via the `asset_logs` join was conflating
     * "campaign drove sharing" with "campaign happened to reward
     * sharing". `asset_logs` rows are unambiguously per-campaign.
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
            result.set(row.campaignRuleId, Number(row.rewardsCount));
        }
        return result;
    }

    private async getPurchases(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewPurchases> {
        const granularity = pickGranularity(range);
        const bucketExpr = sql`DATE_TRUNC(${granularity}, ${purchasesTable.createdAt})`;

        const rows = await db
            .select({
                bucket: sql<Date>`${bucketExpr}`.as("bucket"),
                value: count(),
            })
            .from(purchasesTable)
            .innerJoin(
                merchantWebhooksTable,
                eq(merchantWebhooksTable.id, purchasesTable.webhookId)
            )
            .where(
                and(
                    eq(merchantWebhooksTable.merchantId, merchantId),
                    between(purchasesTable.createdAt, range.from, range.to)
                )
            )
            .groupBy(sql`bucket`)
            .orderBy(asc(sql`bucket`));

        const series = (rows as PurchasesBucketRow[])
            .map((row) => ({
                label: formatBucketLabel(row.bucket, granularity),
                value: Number(row.value),
            }))
            .slice(-MAX_BUCKETS);

        const total = series.reduce((acc, b) => acc + b.value, 0);
        const monthsInWindow = Math.max(
            (range.to.getTime() - range.from.getTime()) / DAY_MS / 30,
            1
        );
        const avgPerMonth = total / monthsInWindow;

        return {
            total,
            avgPerMonth: Math.round(avgPerMonth),
            series,
        };
    }

    private async getProjectedRevenue(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewProjectedRevenue> {
        const granularity = pickGranularity(range);
        const bucketExpr = sql`DATE_TRUNC(${granularity}, ${purchasesTable.createdAt})`;

        const rows = await db
            .select({
                bucket: sql<Date>`${bucketExpr}`.as("bucket"),
                value: sql<string>`COALESCE(SUM(${purchasesTable.totalPrice}::NUMERIC), 0)`,
            })
            .from(purchasesTable)
            .innerJoin(
                merchantWebhooksTable,
                eq(merchantWebhooksTable.id, purchasesTable.webhookId)
            )
            .where(
                and(
                    eq(merchantWebhooksTable.merchantId, merchantId),
                    between(purchasesTable.createdAt, range.from, range.to)
                )
            )
            .groupBy(sql`bucket`)
            .orderBy(asc(sql`bucket`));

        const actualSeries = (rows as RevenueBucketRow[])
            .map((row) => ({
                label: formatBucketLabel(row.bucket, granularity),
                value: Number(row.value),
            }))
            .slice(-MAX_BUCKETS);

        const series: OverviewProjectedRevenue["series"] = actualSeries.map(
            (b) => ({ label: b.label, actual: round2(b.value) })
        );

        // Anchor the forecast: the last actual bucket also carries the
        // first forecast point so the chart line is continuous.
        const forecastValues = projectForecast(
            actualSeries.map((b) => b.value)
        );
        if (forecastValues.length > 0 && series.length > 0) {
            const last = series[series.length - 1];
            last.forecast = round2(forecastValues[0]);

            for (let i = 1; i < forecastValues.length; i += 1) {
                const nextDate = addBucket(
                    parseBucketLabel(last.label, granularity),
                    granularity,
                    i
                );
                series.push({
                    label: formatBucketLabel(nextDate, granularity),
                    forecast: round2(forecastValues[i]),
                });
            }
        }

        const total = series.reduce(
            (acc, b) => acc + (b.actual ?? b.forecast ?? 0),
            0
        );

        return { total: round2(total), series };
    }

    private async getTokenPricesForMerchant(
        merchantId: string
    ): Promise<TokenPriceMap> {
        const tokenRows = await db
            .selectDistinct({ tokenAddress: assetLogsTable.tokenAddress })
            .from(assetLogsTable)
            .where(eq(assetLogsTable.merchantId, merchantId));

        const tokens = tokenRows
            .map((r) => r.tokenAddress)
            .filter((addr): addr is Address => addr !== null)
            .map((addr) => getAddress(addr));

        const prices: TokenPriceMap = new Map();
        await Promise.all(
            tokens.map(async (token) => {
                const price = await this.pricingRepository.getTokenPrice({
                    token,
                });
                if (price) prices.set(token, price.usd);
            })
        );
        return prices;
    }
}

/**
 * Build a CASE expression that converts on-chain reward amounts to USD.
 * Mirrors `MemberQueryOrchestrator.buildUsdRewardsExpression`.
 */
function buildUsdRewardsExpression(prices: TokenPriceMap): SQL {
    if (prices.size === 0) return sql`0`;
    const whenClauses: SQL[] = [];
    for (const [token, usdPrice] of prices) {
        whenClauses.push(
            sql`WHEN ${assetLogsTable.tokenAddress} = ${token} THEN ${assetLogsTable.amount}::NUMERIC * ${usdPrice}`
        );
    }
    return sql`CASE ${sql.join(whenClauses, sql` `)} ELSE 0 END`;
}

function resolveWindow(window: OverviewWindowQuery): ResolvedWindow {
    const to = window.to ? endOfIsoDay(window.to) : new Date();
    const defaultFrom = new Date(to.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);
    const from = window.from ? startOfIsoDay(window.from) : defaultFrom;

    const lengthMs = Math.max(to.getTime() - from.getTime(), DAY_MS);
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - lengthMs);

    return {
        current: { from, to },
        previous: { from: previousFrom, to: previousTo },
    };
}

function startOfIsoDay(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

function endOfIsoDay(value: string): Date {
    return new Date(`${value}T23:59:59.999Z`);
}

function pickGranularity(range: DateRange): "day" | "month" {
    const days = (range.to.getTime() - range.from.getTime()) / DAY_MS;
    return days >= MONTHLY_BUCKET_THRESHOLD_DAYS ? "month" : "day";
}

const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

function formatBucketLabel(date: Date, granularity: "day" | "month"): string {
    if (granularity === "month") {
        return MONTH_LABELS[date.getUTCMonth()];
    }
    const day = `${date.getUTCDate()}`.padStart(2, "0");
    return `${MONTH_LABELS[date.getUTCMonth()]} ${day}`;
}

function parseBucketLabel(label: string, granularity: "day" | "month"): Date {
    const monthIdx = MONTH_LABELS.findIndex((m) => label.startsWith(m));
    const now = new Date();
    if (granularity === "month") {
        return new Date(Date.UTC(now.getUTCFullYear(), monthIdx, 1));
    }
    const day = Number.parseInt(label.split(" ")[1] ?? "1", 10);
    return new Date(Date.UTC(now.getUTCFullYear(), monthIdx, day));
}

function addBucket(
    base: Date,
    granularity: "day" | "month",
    steps: number
): Date {
    const next = new Date(base.getTime());
    if (granularity === "month") {
        next.setUTCMonth(next.getUTCMonth() + steps);
    } else {
        next.setUTCDate(next.getUTCDate() + steps);
    }
    return next;
}

/**
 * Naive forecast: average the slope of the last `FORECAST_LOOKBACK` buckets
 * and project `FORECAST_BUCKETS` ahead. Good enough as a v1 — see
 * `docs/campaigns-overview-endpoint.md` for the upgrade plan.
 */
function projectForecast(actuals: number[]): number[] {
    if (actuals.length === 0) return [];
    const lookback = actuals.slice(-FORECAST_LOOKBACK);
    const last = lookback[lookback.length - 1];

    if (lookback.length < 2) {
        return Array.from({ length: FORECAST_BUCKETS }, () => last);
    }

    let slopeSum = 0;
    for (let i = 1; i < lookback.length; i += 1) {
        slopeSum += lookback[i] - lookback[i - 1];
    }
    const slope = slopeSum / (lookback.length - 1);

    const forecasts: number[] = [];
    for (let i = 1; i <= FORECAST_BUCKETS; i += 1) {
        forecasts.push(Math.max(last + slope * i, 0));
    }
    return forecasts;
}

function surfaceCampaignStatus(
    status: CampaignStatus,
    expiresAt: Date | null,
    now: Date
): OverviewTopCampaign["status"] {
    if (status === "archived") return "ended";
    if (status === "active" && expiresAt && expiresAt < now) return "ended";
    if (status === "active" || status === "paused" || status === "draft") {
        return status;
    }
    return "ended";
}

function safeRatio(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return numerator / denominator;
}

function percentDelta(current: number, previous: number): number | undefined {
    if (previous === 0) return current === 0 ? 0 : undefined;
    return Math.round(((current - previous) / previous) * 100);
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}
