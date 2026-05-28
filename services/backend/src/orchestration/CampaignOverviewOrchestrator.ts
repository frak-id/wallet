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
    OverviewGranularity,
    OverviewKpis,
    OverviewSeries,
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

type DateRange = { from: Date; to: Date };
type ResolvedWindow = { current: DateRange; previous: DateRange };
type TokenPriceMap = Map<string, number>;

type AssetKpiRow = {
    ambassadorsCurrent: string;
    ambassadorsPrevious: string;
    rewardsUsdCurrent: string;
    rewardsUsdPrevious: string;
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
    bucket: Date;
    purchaseCount: string;
    revenue: string;
};

/**
 * Aggregates the "campaigns overview" dashboard summary from Postgres only.
 * OpenPanel-backed funnels and sharing breakdowns are handled by a sibling
 * `CampaignAnalyticsOrchestrator`.
 *
 * Window contract:
 *   - KPIs return `{ current, previous }` for both halves of the comparison.
 *     The previous window is the same-length range ending immediately
 *     before `current.from`. Both halves are computed in a single SQL
 *     scan per source table using `FILTER (WHERE …)` aggregates.
 *   - Series buckets are emitted as raw `{ bucket: ISO, purchaseCount,
 *     revenue }` triples. Labels, forecasting and currency formatting are
 *     a frontend concern (i18n + locale-aware).
 */
export class CampaignOverviewOrchestrator {
    constructor(private readonly pricingRepository: PricingRepository) {}

    async getSummary(
        merchantId: string,
        window: OverviewWindowQuery
    ): Promise<OverviewSummaryResponse> {
        const resolved = resolveWindow(window);

        const tokenPrices = await this.getTokenPricesForMerchant(merchantId);
        const usdRewardsExpr = buildUsdRewardsExpression(tokenPrices);

        const [kpis, topAndStatus, series] = await Promise.all([
            this.getKpis(merchantId, resolved, usdRewardsExpr),
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
     * Three SQL scans (asset_logs, interaction_logs, purchases) each
     * computing current + previous via `FILTER (WHERE …)` aggregates so
     * we read each source table exactly once.
     */
    private async getKpis(
        merchantId: string,
        resolved: ResolvedWindow,
        usdRewardsExpr: SQL
    ): Promise<OverviewKpis> {
        const { current, previous } = resolved;
        const outerFrom = previous.from;
        const outerTo = current.to;

        // FILTER clauses use drizzle's `between()` so Date params flow
        // through the column encoder (Date → ISO). Raw `${date}` falls
        // through to `String(date)` and PG rejects the timezone format.
        const [assetRows, sharesRows, purchaseRows] = await Promise.all([
            db
                .select({
                    ambassadorsCurrent: sql<string>`COUNT(DISTINCT ${assetLogsTable.identityGroupId}) FILTER (WHERE ${assetLogsTable.recipientType} = 'referrer' AND ${between(assetLogsTable.createdAt, current.from, current.to)})`,
                    ambassadorsPrevious: sql<string>`COUNT(DISTINCT ${assetLogsTable.identityGroupId}) FILTER (WHERE ${assetLogsTable.recipientType} = 'referrer' AND ${between(assetLogsTable.createdAt, previous.from, previous.to)})`,
                    rewardsUsdCurrent: sql<string>`COALESCE(SUM(${usdRewardsExpr}) FILTER (WHERE ${between(assetLogsTable.createdAt, current.from, current.to)}), 0)`,
                    rewardsUsdPrevious: sql<string>`COALESCE(SUM(${usdRewardsExpr}) FILTER (WHERE ${between(assetLogsTable.createdAt, previous.from, previous.to)}), 0)`,
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
            db
                .select({
                    revenueCurrent: sql<string>`COALESCE(SUM(${purchasesTable.totalPrice}::NUMERIC) FILTER (WHERE ${between(purchasesTable.createdAt, current.from, current.to)}), 0)`,
                    revenuePrevious: sql<string>`COALESCE(SUM(${purchasesTable.totalPrice}::NUMERIC) FILTER (WHERE ${between(purchasesTable.createdAt, previous.from, previous.to)}), 0)`,
                    purchaseCountCurrent: sql<string>`COUNT(*) FILTER (WHERE ${between(purchasesTable.createdAt, current.from, current.to)})`,
                    purchaseCountPrevious: sql<string>`COUNT(*) FILTER (WHERE ${between(purchasesTable.createdAt, previous.from, previous.to)})`,
                    // MODE() returns the most-frequent currency in the
                    // current window. Strictly speaking purchases can
                    // arrive in mixed currencies — taking the mode keeps
                    // the SUM consistent with the displayed unit for the
                    // vast majority of merchants who only use one.
                    currency: sql<
                        string | null
                    >`MODE() WITHIN GROUP (ORDER BY ${purchasesTable.currencyCode}) FILTER (WHERE ${between(purchasesTable.createdAt, current.from, current.to)})`,
                })
                .from(purchasesTable)
                .innerJoin(
                    merchantWebhooksTable,
                    eq(merchantWebhooksTable.id, purchasesTable.webhookId)
                )
                .where(
                    and(
                        eq(merchantWebhooksTable.merchantId, merchantId),
                        between(purchasesTable.createdAt, outerFrom, outerTo)
                    )
                ),
        ]);

        const assetRow = (assetRows[0] ?? {}) as Partial<AssetKpiRow>;
        const sharesRow = (sharesRows[0] ?? {}) as Partial<SharesKpiRow>;
        const purchaseRow = (purchaseRows[0] ?? {}) as Partial<PurchaseKpiRow>;

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
            totalRewardsUsd: {
                current: toNumber(assetRow.rewardsUsdCurrent),
                previous: toNumber(assetRow.rewardsUsdPrevious),
            },
            purchaseCount: {
                current: toNumber(purchaseRow.purchaseCountCurrent),
                previous: toNumber(purchaseRow.purchaseCountPrevious),
            },
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

    /**
     * Bucketed purchases + revenue series for the current window. Single
     * scan over `purchases ⋈ merchant_webhooks` returns both metrics —
     * the dashboard renders them as two separate cards but they share
     * the same underlying data.
     */
    private async getSeries(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewSeries> {
        const granularity = pickGranularity(range);
        const bucketExpr = sql`DATE_TRUNC(${granularity}, ${purchasesTable.createdAt})`;

        const rows = await db
            .select({
                bucket: sql<Date>`${bucketExpr}`.as("bucket"),
                purchaseCount: sql<string>`COUNT(*)`,
                revenue: sql<string>`COALESCE(SUM(${purchasesTable.totalPrice}::NUMERIC), 0)`,
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

        const buckets = (rows as SeriesRow[]).map((row) => ({
            bucket: row.bucket.toISOString(),
            purchaseCount: toNumber(row.purchaseCount),
            revenue: toNumber(row.revenue),
        }));

        return { granularity, buckets };
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

function pickGranularity(range: DateRange): OverviewGranularity {
    const days = (range.to.getTime() - range.from.getTime()) / DAY_MS;
    return days >= MONTHLY_BUCKET_THRESHOLD_DAYS ? "month" : "day";
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

/**
 * Postgres `numeric` returns strings; counts come back as strings too
 * via the node-postgres driver. Centralise the cast so `getKpis` /
 * `getSeries` stay readable.
 */
function toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}
