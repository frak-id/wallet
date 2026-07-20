import {
    extractMinPurchaseAmount,
    pickFlatBasket,
    pickTierBasket,
} from "@frak-labs/core-sdk/rewards";
import {
    and,
    count,
    eq,
    gt,
    inArray,
    isNotNull,
    isNull,
    or,
    sql,
} from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { Address } from "viem";
import { affiliateBrandTable } from "../domain/affiliate/db/schema";
import { campaignRulesTable } from "../domain/campaign/db/schema";
import type { RewardDefinition } from "../domain/campaign/schemas";
import {
    merchantExplorerRankingTable,
    merchantsTable,
} from "../domain/merchant/db/schema";
import { interactionLogsTable } from "../domain/rewards/db/schema";
import {
    openPanelExportClient,
    serieSum,
} from "../infrastructure/integrations/openpanel";
import { db } from "../infrastructure/persistence/postgres";
import type {
    PricingRepository,
    TokenPrice,
} from "../infrastructure/pricing/PricingRepository";
import type {
    ExplorerMerchantItem,
    ExplorerQueryResult,
} from "./schemas/explorerSchemas";

type ExplorerQueryParams = {
    limit?: number;
    offset?: number;
};

// Popularity window: interactions in the trailing 30 days.
const POPULARITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Views live in their own long-lived cache: one OpenPanel breakdown serves
// every merchant/page, and the export API is slow, so we hold it for 2 hours.
const VIEWS_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const VIEWS_CACHE_KEY = "all";
// OpenPanel has no "all-time" range, so we span from a fixed floor (before the
// wallet explorer shipped) to now — effectively every recorded card view.
const VIEWS_SINCE_ISO = "2024-01-01T00:00:00.000Z";
// The event carries `properties.merchant_id`, matching `merchants.id`.
const VIEWS_BREAKDOWN = "properties.merchant_id";

export class ExplorerOrchestrator {
    constructor(private readonly pricingRepository: PricingRepository) {}

    private readonly cache = new LRUCache<
        string,
        { value: ExplorerQueryResult }
    >({
        max: 128,
        ttl: 30_000,
    });

    // Total explorer-card views per merchant, keyed by a single global key
    // (one breakdown query covers every merchant). Kept separate from the
    // per-page query cache so its slow OpenPanel refresh runs at most 2-hourly.
    private readonly viewsCache = new LRUCache<string, Map<string, number>>({
        max: 1,
        ttl: VIEWS_CACHE_TTL_MS,
    });

    async queryMerchants(
        params: ExplorerQueryParams
    ): Promise<ExplorerQueryResult> {
        const limit = params.limit ?? 20;
        const offset = params.offset ?? 0;
        const cacheKey = `${limit}:${offset}`;

        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached.value;
        }

        const result = await this.fetchMerchants(limit, offset);
        this.cache.set(cacheKey, { value: result });
        return result;
    }

    invalidateCache(): void {
        this.cache.clear();
    }

    private async fetchMerchants(
        limit: number,
        offset: number
    ): Promise<ExplorerQueryResult> {
        const now = new Date();
        // ISO string (not a raw Date): inside a raw `sql` template drizzle skips
        // the timestamp column encoder, so a Date object reaches the driver
        // unconverted and Postgres can't parse it. Matches how drizzle sends
        // timestamp comparisons elsewhere in this query.
        const popularitySince = new Date(
            now.getTime() - POPULARITY_WINDOW_MS
        ).toISOString();

        const activeCampaignFilter = and(
            eq(campaignRulesTable.status, "active"),
            or(
                isNull(campaignRulesTable.expiresAt),
                gt(campaignRulesTable.expiresAt, now)
            )
        );

        const rows = await db
            .select({
                id: merchantsTable.id,
                name: merchantsTable.name,
                domain: merchantsTable.domain,
                explorerConfig: merchantsTable.explorerConfig,
                defaultRewardToken: merchantsTable.defaultRewardToken,
                activeCampaignCount: count(campaignRulesTable.id).as(
                    "active_campaign_count"
                ),
                // Freshest active campaign, favouring publish time and falling
                // back to creation time for never-republished drafts.
                recentAt: sql<Date | null>`MAX(COALESCE(
                    ${campaignRulesTable.publishedAt},
                    ${campaignRulesTable.createdAt}
                ))`.as("recent_at"),
                // Soonest end date among active campaigns (MIN ignores the
                // NULL/no-end-date campaigns), null when none expire.
                expiringAt:
                    sql<Date | null>`MIN(${campaignRulesTable.expiresAt})`.as(
                        "expiring_at"
                    ),
                // Trailing-month interaction count. Correlated scalar subquery
                // (keyed on the grouped merchant id) so it never fans out the
                // campaign-count grouping.
                popularity: sql<number>`(
                    SELECT COUNT(*) FROM ${interactionLogsTable}
                    WHERE ${interactionLogsTable.merchantId} = ${merchantsTable.id}
                    AND ${interactionLogsTable.cancelledAt} IS NULL
                    AND ${interactionLogsTable.createdAt} >= ${popularitySince}
                )`
                    .mapWith(Number)
                    .as("popularity"),
                // Correlated EXISTS (not a join) so multiple affiliate brand
                // links per merchant never fan out the campaign-count grouping.
                integration: sql<"native" | "affiliate">`CASE WHEN EXISTS (
                    SELECT 1 FROM ${affiliateBrandTable}
                    WHERE ${affiliateBrandTable.merchantId} = ${merchantsTable.id}
                ) THEN 'affiliate' ELSE 'native' END`.as("integration"),
                totalResult: sql<number>`COUNT(*) OVER()`
                    .mapWith(Number)
                    .as("total_result"),
            })
            .from(merchantsTable)
            .innerJoin(
                campaignRulesTable,
                and(
                    eq(campaignRulesTable.merchantId, merchantsTable.id),
                    activeCampaignFilter
                )
            )
            .leftJoin(
                merchantExplorerRankingTable,
                eq(merchantExplorerRankingTable.merchantId, merchantsTable.id)
            )
            .where(isNotNull(merchantsTable.explorerEnabledAt))
            .groupBy(
                merchantsTable.id,
                merchantExplorerRankingTable.manualBoost
            )
            .orderBy(
                sql`COALESCE(${merchantExplorerRankingTable.manualBoost}, 0) DESC`,
                sql`COUNT(${campaignRulesTable.id}) DESC`
            )
            .limit(limit)
            .offset(offset);

        if (rows.length === 0) {
            return { totalResult: 0, merchants: [] };
        }

        const totalResult = rows[0]?.totalResult ?? 0;

        const [rewardByMerchant, viewsByMerchant] = await Promise.all([
            this.computeMaxRewardByMerchant(
                rows.map((row) => ({
                    merchantId: row.id,
                    defaultRewardToken: row.defaultRewardToken,
                })),
                now
            ),
            this.getViewsByMerchant(),
        ]);

        const merchants: ExplorerMerchantItem[] = rows.map((row) => ({
            id: row.id,
            name: row.name,
            domain: row.domain,
            explorerConfig: row.explorerConfig ?? null,
            activeCampaignCount: Number(row.activeCampaignCount),
            integration: row.integration,
            popularity: Number(row.popularity),
            views: viewsByMerchant.get(row.id) ?? 0,
            recent: row.recentAt ? new Date(row.recentAt).toISOString() : null,
            expiring: row.expiringAt
                ? new Date(row.expiringAt).toISOString()
                : null,
            reward: rewardByMerchant.get(row.id) ?? null,
        }));

        return { totalResult, merchants };
    }

    /**
     * Total `explorer_card_viewed` impressions per merchant id, from OpenPanel.
     *
     * One breakdown query (on `properties.merchant_id`) covers every merchant,
     * and the export API is slow, so the whole map is cached for 2 hours (see
     * `viewsCache`). A failed/empty OpenPanel response degrades to an empty map
     * (all merchants report 0 views) rather than breaking the explorer.
     */
    private async getViewsByMerchant(): Promise<Map<string, number>> {
        const cached = this.viewsCache.get(VIEWS_CACHE_KEY);
        if (cached) {
            return cached;
        }

        const response = await openPanelExportClient.getChart({
            series: [{ name: "explorer_card_viewed" }],
            startDate: VIEWS_SINCE_ISO,
            endDate: new Date().toISOString(),
            range: "custom",
            interval: "month",
            breakdowns: [{ name: VIEWS_BREAKDOWN }],
        });

        // One serie per (event × merchant_id) tuple; `serieSum` totals its
        // buckets. Multiple series can share a merchant id, so accumulate.
        const views = new Map<string, number>();
        for (const serie of response.series) {
            const merchantId = serie.event.breakdowns?.[VIEWS_BREAKDOWN];
            if (!merchantId) continue;
            views.set(
                merchantId,
                (views.get(merchantId) ?? 0) + serieSum(serie)
            );
        }

        this.viewsCache.set(VIEWS_CACHE_KEY, views);
        return views;
    }

    /**
     * Highest euro-valued reward a user could earn per merchant, across its
     * active campaigns. Percentage rewards are valued against a reference
     * basket (shared with the wallet frontend); fixed/tiered token payouts are
     * converted via the token's live price (falling back to the merchant's
     * default reward token when a reward omits its own). Tokens without a price
     * simply contribute 0. Returns an empty map when nothing can be valued.
     */
    private async computeMaxRewardByMerchant(
        merchants: { merchantId: string; defaultRewardToken: Address }[],
        now: Date
    ): Promise<Map<string, number>> {
        const merchantIds = merchants.map((m) => m.merchantId);
        const defaultTokenByMerchant = new Map(
            merchants.map((m) => [m.merchantId, m.defaultRewardToken])
        );

        const campaigns = await db
            .select({
                merchantId: campaignRulesTable.merchantId,
                rule: campaignRulesTable.rule,
            })
            .from(campaignRulesTable)
            .where(
                and(
                    inArray(campaignRulesTable.merchantId, merchantIds),
                    eq(campaignRulesTable.status, "active"),
                    or(
                        isNull(campaignRulesTable.expiresAt),
                        gt(campaignRulesTable.expiresAt, now)
                    )
                )
            );

        const priceByToken = await this.fetchRewardPrices(
            campaigns,
            defaultTokenByMerchant
        );

        const rewardByMerchant = new Map<string, number>();
        for (const campaign of campaigns) {
            const fallback = defaultTokenByMerchant.get(campaign.merchantId);
            const minPurchase = extractMinPurchaseAmount(
                campaign.rule.conditions
            );
            const value = maxRewardEurValue(
                campaign.rule.rewards,
                fallback,
                priceByToken,
                minPurchase
            );
            const current = rewardByMerchant.get(campaign.merchantId) ?? 0;
            if (value > current) {
                rewardByMerchant.set(campaign.merchantId, value);
            }
        }

        return rewardByMerchant;
    }

    /**
     * Fetch the live price of every token referenced by the given campaigns
     * (reward-level override, else the owning merchant's default), once each.
     */
    private async fetchRewardPrices(
        campaigns: {
            merchantId: string;
            rule: { rewards: RewardDefinition[] };
        }[],
        defaultTokenByMerchant: Map<string, Address>
    ): Promise<Map<Address, TokenPrice>> {
        const tokens = new Set<Address>();
        for (const campaign of campaigns) {
            const fallback = defaultTokenByMerchant.get(campaign.merchantId);
            for (const reward of campaign.rule.rewards) {
                const token = rewardToken(reward, fallback);
                if (token) tokens.add(token);
            }
        }

        const priceByToken = new Map<Address, TokenPrice>();
        await Promise.all(
            [...tokens].map(async (token) => {
                const price = await this.pricingRepository.getTokenPrice({
                    token,
                });
                if (price) priceByToken.set(token, price);
            })
        );
        return priceByToken;
    }
}

function rewardToken(
    reward: RewardDefinition,
    fallback: Address | undefined
): Address | undefined {
    return (reward.token as Address | undefined) ?? fallback;
}

// Highest euro value among a campaign's reward definitions.
function maxRewardEurValue(
    rewards: RewardDefinition[],
    fallbackToken: Address | undefined,
    priceByToken: Map<Address, TokenPrice>,
    minPurchase: number | undefined
): number {
    let max = 0;
    for (const reward of rewards) {
        const token = rewardToken(reward, fallbackToken);
        const price = token ? priceByToken.get(token) : undefined;
        const value = rewardDefinitionEurValue(reward, price, minPurchase);
        if (value > max) max = value;
    }
    return max;
}

/**
 * Euro value of a single reward definition. Percentage payouts are valued
 * against a reference basket (`pickFlatBasket`/`pickTierBasket`, shared with
 * the wallet frontend so both surfaces advertise the same figure); token
 * amounts are priced through `price` (0 when no price is available, matching
 * the estimated-reward behaviour).
 */
function rewardDefinitionEurValue(
    reward: RewardDefinition,
    price: TokenPrice | undefined,
    minPurchase: number | undefined
): number {
    switch (reward.amountType) {
        case "fixed":
            return price ? reward.amount * price.eur : 0;
        case "percentage":
            return percentageRewardEurValue(reward, price, minPurchase);
        case "tiered":
            return tieredRewardEurValue(reward, price);
    }
}

function percentageRewardEurValue(
    reward: Extract<RewardDefinition, { amountType: "percentage" }>,
    price: TokenPrice | undefined,
    minPurchase: number | undefined
): number {
    let value = (reward.percent / 100) * pickFlatBasket(minPurchase);
    // minAmount/maxAmount are token caps — valued only when a price is known.
    // Compare against `undefined` (not falsy) so a legitimate `0` cap applies.
    if (price && reward.minAmount !== undefined) {
        value = Math.max(value, reward.minAmount * price.eur);
    }
    if (price && reward.maxAmount !== undefined) {
        value = Math.min(value, reward.maxAmount * price.eur);
    }
    return value;
}

function tieredRewardEurValue(
    reward: Extract<RewardDefinition, { amountType: "tiered" }>,
    price: TokenPrice | undefined
): number {
    let max = 0;
    for (const tier of reward.tiers) {
        // Percentage tiers apply to a basket picked within the tier's [min, max]
        // range (shared with the frontend); flat tiers are priced token amounts.
        const value =
            "percent" in tier
                ? (tier.percent / 100) *
                  pickTierBasket(tier.minValue, tier.maxValue)
                : price
                  ? tier.amount * price.eur
                  : 0;
        if (value > max) max = value;
    }
    return max;
}
