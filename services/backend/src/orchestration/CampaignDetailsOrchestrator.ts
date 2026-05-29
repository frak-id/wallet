import {
    and,
    countDistinct,
    eq,
    inArray,
    isNotNull,
    isNull,
    type SQL,
    sql,
} from "drizzle-orm";
import { type Address, bytesToHex, getAddress, zeroAddress } from "viem";
import { referralLinksTable } from "../domain/attribution/db/schema";
import { identityNodesTable } from "../domain/identity/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../domain/rewards/db/schema";
import { db } from "../infrastructure/persistence/postgres";
import type { PricingRepository } from "../infrastructure/pricing/PricingRepository";
import type {
    CampaignDetailsResponse,
    CpaSegmentKey,
} from "./schemas/campaignDetailsSchemas";
import {
    metaCpaForCurrency,
    PLATFORM_FEE_PCT,
} from "./utils/campaignBenchmarks";

/** Top-N cap on the ambassador leaderboard returned by Bundle B. */
const TOP_AMBASSADORS_LIMIT = 10;

/**
 * Aggregates the per-campaign details endpoint
 * (`GET /business/merchant/:merchantId/campaigns/:campaignId/details`)
 * from Postgres. No OpenPanel / no indexer.
 *
 * Pipeline:
 *  1. Resolve the campaign's modal purchase currency + referees-converted
 *     counts (`getCurrencyAndReferees`). Sequential because the currency
 *     drives token→fiat conversion downstream.
 *  2. In parallel: campaign roll-up (spend / conversions / ambassador
 *     split), top-N leaderboard (earned + shares + revenue + sales),
 *     and total interacting users for the `activePct` denominator.
 *  3. `assembleResponse` derives all ratios: cpa, Meta benchmark math
 *     (cheaperPct / savedVsMeta), cpaBreakdown segments (frak overlay +
 *     scaled ambassador/referee), roi, avgReward, topPerformer.
 *
 * All numeric outputs are denominated in the campaign's modal purchase
 * currency. When no purchases exist for the campaign the response falls
 * back to EUR.
 */
export class CampaignDetailsOrchestrator {
    constructor(private readonly pricingRepository: PricingRepository) {}

    async getDetailsForCampaign(
        merchantId: string,
        campaignId: string
    ): Promise<CampaignDetailsResponse> {
        // Bundle C runs first because the currency it returns drives token
        // → fiat conversion for Bundles A and B. The query is cheap (a
        // single MODE() aggregate over the merchant's purchases) so the
        // serialisation cost is negligible.
        const { currency, totalReferees, convertedReferees } =
            await this.getCurrencyAndReferees(merchantId, campaignId);

        // Build a token_address → fiat-price map keyed off the currency
        // we just resolved. `TokenPrice` exposes `{ eur, usd, gbp }` per
        // token directly so we don't need a separate FX step.
        const tokenPrices = await this.getTokenFiatPrices(campaignId, currency);
        const fiatRewardsExpr = buildFiatRewardsExpression(tokenPrices);

        const [campaignRollup, leaderboard, interactingUsers] =
            await Promise.all([
                this.getCampaignRollup(campaignId, fiatRewardsExpr),
                this.getLeaderboard(merchantId, campaignId, fiatRewardsExpr),
                this.getInteractingUsersCount(merchantId),
            ]);

        return this.assembleResponse({
            currency,
            campaignRollup,
            leaderboard,
            totalReferees,
            convertedReferees,
            interactingUsers,
        });
    }

    /**
     * Distinct identity_groups that have ≥1 `interaction_logs` row with
     * this merchant — i.e. anyone who arrived, shared, purchased, or did
     * anything else this merchant tracks. Forms the denominator for
     * `ambassadorStats.activePct` ("of the merchant's active audience,
     * X% became ambassadors on this campaign").
     */
    private async getInteractingUsersCount(
        merchantId: string
    ): Promise<number> {
        const [row] = await db
            .select({
                count: countDistinct(interactionLogsTable.identityGroupId),
            })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.merchantId, merchantId),
                    isNull(interactionLogsTable.cancelledAt),
                    isNotNull(interactionLogsTable.identityGroupId)
                )
            );

        return toNumber(row?.count);
    }

    /**
     * Bundle C — campaign currency + referee conversion stats.
     *
     * Two queries, both campaign-scoped:
     *  1. `asset_logs ⋈ interaction_logs` reads the modal purchase
     *     currency and counts distinct referees who triggered a
     *     `referrer` reward on this campaign (the `convertedReferees`).
     *     The interaction's JSONB payload carries the fiat currency
     *     directly, so no `purchases` join is needed.
     *  2. A residual `referral_links` lookup gives the denominator
     *     `totalReferees` — distinct referees brought in by any of this
     *     campaign's ambassadors. Without it we can't compute
     *     `refereesConvertedPct`.
     *
     * Evolution: if we ever drop `refereesConvertedPct` in favour of a
     * more honest "salesPerReferee = attributedGMV / convertedReferees"
     * or "repeatPurchaseRate = sales / convertedReferees", the residual
     * `referral_links` query goes away and Bundle C becomes a single
     * scan. The current metric requires the merchant-wide referrer
     * graph since not all referees buy — the conversion rate is
     * inherently asymmetric.
     */
    private async getCurrencyAndReferees(
        merchantId: string,
        campaignId: string
    ): Promise<{
        currency: string;
        totalReferees: number;
        convertedReferees: number;
    }> {
        const [purchaseRow, totalReferees] = await Promise.all([
            this.getCurrencyAndConvertedReferees(campaignId),
            this.getTotalRefereesForCampaign(merchantId, campaignId),
        ]);

        return {
            currency: purchaseRow.currency,
            totalReferees,
            convertedReferees: purchaseRow.convertedReferees,
        };
    }

    private async getCurrencyAndConvertedReferees(
        campaignId: string
    ): Promise<{ currency: string; convertedReferees: number }> {
        const [row] = await db
            .select({
                currency: sql<
                    string | null
                >`MODE() WITHIN GROUP (ORDER BY ${interactionLogsTable.payload}->>'currency')`,
                convertedReferees: countDistinct(
                    interactionLogsTable.identityGroupId
                ),
            })
            .from(assetLogsTable)
            .innerJoin(
                interactionLogsTable,
                eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
            )
            .where(
                and(
                    eq(assetLogsTable.campaignRuleId, campaignId),
                    eq(assetLogsTable.recipientType, "referrer"),
                    isNull(assetLogsTable.cancelledAt),
                    eq(interactionLogsTable.type, "purchase"),
                    isNull(interactionLogsTable.cancelledAt)
                )
            );

        return {
            currency: row?.currency ?? "EUR",
            convertedReferees: toNumber(row?.convertedReferees),
        };
    }

    private async getTotalRefereesForCampaign(
        merchantId: string,
        campaignId: string
    ): Promise<number> {
        const ambassadorGroupsSql = sql`
            SELECT DISTINCT ${assetLogsTable.identityGroupId}
            FROM ${assetLogsTable}
            WHERE ${assetLogsTable.campaignRuleId} = ${campaignId}::uuid
              AND ${assetLogsTable.recipientType} = 'referrer'
              AND ${assetLogsTable.cancelledAt} IS NULL
        `;

        const [row] = await db.execute<{ total: string | number }>(sql`
            SELECT COUNT(DISTINCT ${referralLinksTable.refereeIdentityGroupId}) AS total
            FROM ${referralLinksTable}
            WHERE ${referralLinksTable.merchantId} = ${merchantId}::uuid
              AND ${referralLinksTable.removedAt} IS NULL
              AND ${referralLinksTable.referrerIdentityGroupId} IN (${ambassadorGroupsSql})
        `);

        return toNumber(row?.total);
    }

    /**
     * Look up the fiat spot price (in the requested currency) for every
     * distinct token rewarded on this campaign. Scoping to the campaign
     * (rather than the whole merchant) keeps the CoinGecko lookup tight
     * — typically 1 token, sometimes 2 — and makes the CASE expression
     * downstream a single WHEN branch.
     *
     * Tokens whose price lookup fails are dropped: they fall through to
     * the `ELSE 0` branch of `buildFiatRewardsExpression`.
     */
    private async getTokenFiatPrices(
        campaignId: string,
        currency: string
    ): Promise<Map<string, number>> {
        const tokenRows = await db
            .selectDistinct({ tokenAddress: assetLogsTable.tokenAddress })
            .from(assetLogsTable)
            .where(
                and(
                    eq(assetLogsTable.campaignRuleId, campaignId),
                    isNull(assetLogsTable.cancelledAt)
                )
            );

        const tokens = tokenRows
            .map((r) => r.tokenAddress)
            .filter((addr): addr is Address => addr !== null);

        const prices = new Map<string, number>();
        await Promise.all(
            tokens.map(async (token) => {
                const price = await this.pricingRepository.getTokenPrice({
                    token,
                });
                if (!price) return;
                const fiat = pickFiatPrice(price, currency);
                if (fiat !== undefined) prices.set(token, fiat);
            })
        );
        return prices;
    }

    /**
     * Bundle A — campaign-scoped roll-up. Single scan over
     * `asset_logs ⋈ interaction_logs` returns:
     *   - `spend`, `ambassadorAmount`, `refereeAmount` — fiat reward
     *     totals (in the campaign's modal currency) overall and split
     *     by `recipient_type`.
     *   - `conversions`, `ambassadorsTotal` — distinct counts.
     *   - `attributedGMV` — sum of `payload->>'amount'` over the
     *     purchase interactions that triggered a `referrer` reward on
     *     this campaign. Properly campaign-scoped via the asset_log
     *     bridge.
     *
     * `attributedGMV` is computed using a DISTINCT-aware aggregate so
     * that multi-recipient rewards (referrer + referee paid on the same
     * purchase) don't double-count the basket. We do this with a
     * subquery on the asset_log row's interaction so PG can dedupe at
     * the (interaction_log_id, payload->'amount') grain — a referrer
     * and referee row both pointing at the same purchase contribute
     * the basket value once.
     */
    private async getCampaignRollup(
        campaignId: string,
        fiatRewardsExpr: SQL
    ): Promise<{
        spend: number;
        ambassadorAmount: number;
        refereeAmount: number;
        conversions: number;
        ambassadorsTotal: number;
        attributedGMV: number;
    }> {
        const [row] = await db
            .select({
                spend: sql<string>`COALESCE(SUM(${fiatRewardsExpr}), 0)`,
                ambassadorAmount: sql<string>`COALESCE(SUM(${fiatRewardsExpr}) FILTER (WHERE ${assetLogsTable.recipientType} = 'referrer'), 0)`,
                refereeAmount: sql<string>`COALESCE(SUM(${fiatRewardsExpr}) FILTER (WHERE ${assetLogsTable.recipientType} = 'referee'), 0)`,
                conversions: sql<string>`COUNT(DISTINCT ${interactionLogsTable.id}) FILTER (WHERE ${interactionLogsTable.type} = 'purchase')`,
                ambassadorsTotal: sql<string>`COUNT(DISTINCT ${assetLogsTable.identityGroupId}) FILTER (WHERE ${assetLogsTable.recipientType} = 'referrer')`,
            })
            .from(assetLogsTable)
            .leftJoin(
                interactionLogsTable,
                eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
            )
            .where(
                and(
                    eq(assetLogsTable.campaignRuleId, campaignId),
                    isNull(assetLogsTable.cancelledAt)
                )
            );

        const attributedGMV = await this.getAttributedGMV(campaignId);

        return {
            spend: toNumber(row?.spend),
            ambassadorAmount: toNumber(row?.ambassadorAmount),
            refereeAmount: toNumber(row?.refereeAmount),
            conversions: toNumber(row?.conversions),
            ambassadorsTotal: toNumber(row?.ambassadorsTotal),
            attributedGMV,
        };
    }

    /**
     * Sum of fiat purchase amounts for purchases that triggered any
     * reward on this campaign. Uses a subquery on distinct
     * `interaction_log_id` so multi-recipient rewards (a single
     * purchase that paid both referrer and referee, or paid at multiple
     * chain depths) only count the basket once.
     *
     * Walks `asset_logs → interaction_logs` end-to-end. The
     * `recipient_type` filter is dropped here on purpose — a basket
     * counts as long as *anyone* was rewarded for it on this campaign.
     */
    private async getAttributedGMV(campaignId: string): Promise<number> {
        const distinctPurchases = db
            .selectDistinct({
                interactionLogId: assetLogsTable.interactionLogId,
                amount: sql<string>`(${interactionLogsTable.payload}->>'amount')::NUMERIC`.as(
                    "amount"
                ),
            })
            .from(assetLogsTable)
            .innerJoin(
                interactionLogsTable,
                eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
            )
            .where(
                and(
                    eq(assetLogsTable.campaignRuleId, campaignId),
                    isNull(assetLogsTable.cancelledAt),
                    eq(interactionLogsTable.type, "purchase"),
                    isNull(interactionLogsTable.cancelledAt)
                )
            )
            .as("distinct_purchases");

        const [row] = await db
            .select({
                gmv: sql<string>`COALESCE(SUM(${distinctPurchases.amount}), 0)`,
            })
            .from(distinctPurchases);

        return toNumber(row?.gmv);
    }

    /**
     * Bundle B — top-N referrer leaderboard.
     *
     * Split into two queries to avoid the multi-LEFT-JOIN double-count
     * trap:
     *   B1 — per-ambassador `earned`, campaign-scoped via `asset_logs`.
     *        This is the source-of-truth set of "ambassadors who earned
     *        on this campaign" — everyone else is dropped from the
     *        leaderboard.
     *   B2 — per-ambassador `shares` (create_referral_link count) and
     *        `revenue`/`sales` (referee purchases). Merchant-scoped on
     *        the referrer's identity_group, so an ambassador's shares
     *        across other campaigns count too. See schema JSDoc.
     */
    private async getLeaderboard(
        merchantId: string,
        campaignId: string,
        fiatRewardsExpr: SQL
    ): Promise<{
        rows: Array<{
            wallet: Address;
            earned: number;
            shares: number;
            sales: number;
            revenue: number;
        }>;
        totalRevenue: number;
    }> {
        const earnedRows = await db
            .select({
                identityGroupId: assetLogsTable.identityGroupId,
                wallet: sql<
                    Buffer | string | null
                >`MAX(${identityNodesTable.identityValue}::text)`,
                earned: sql<string>`COALESCE(SUM(${fiatRewardsExpr}), 0)`,
            })
            .from(assetLogsTable)
            .leftJoin(
                identityNodesTable,
                and(
                    eq(
                        assetLogsTable.identityGroupId,
                        identityNodesTable.groupId
                    ),
                    eq(identityNodesTable.identityType, "wallet"),
                    sql`${identityNodesTable.merchantId} IS NULL`,
                    sql`${identityNodesTable.unlinkedAt} IS NULL`
                )
            )
            .where(
                and(
                    eq(assetLogsTable.campaignRuleId, campaignId),
                    eq(assetLogsTable.recipientType, "referrer"),
                    isNull(assetLogsTable.cancelledAt)
                )
            )
            .groupBy(assetLogsTable.identityGroupId);

        const ambassadorIds = earnedRows.map((r) => r.identityGroupId);
        if (ambassadorIds.length === 0) {
            return { rows: [], totalRevenue: 0 };
        }

        const [sharesRows, revenueRows] = await Promise.all([
            this.getSharesPerAmbassador(merchantId, ambassadorIds),
            this.getRevenuePerAmbassador(campaignId, ambassadorIds),
        ]);

        const sharesByGroup = new Map(
            sharesRows.map((r) => [r.identityGroupId, r.shares])
        );
        const revenueByGroup = new Map(
            revenueRows.map((r) => [
                r.identityGroupId,
                { revenue: r.revenue, sales: r.sales },
            ])
        );

        let totalRevenue = 0;
        const merged = earnedRows.map((row) => {
            const wallet = normaliseWallet(row.wallet);
            const revenue = revenueByGroup.get(row.identityGroupId);
            totalRevenue += revenue?.revenue ?? 0;
            return {
                wallet,
                earned: toNumber(row.earned),
                shares: sharesByGroup.get(row.identityGroupId) ?? 0,
                sales: revenue?.sales ?? 0,
                revenue: revenue?.revenue ?? 0,
            };
        });

        // Sort by revenue (the metric the FE leaderboard ranks on) with
        // `earned` as a stable tiebreaker for ambassadors with no
        // attributed purchase revenue yet.
        merged.sort((a, b) => b.revenue - a.revenue || b.earned - a.earned);

        return {
            rows: merged.slice(0, TOP_AMBASSADORS_LIMIT),
            totalRevenue,
        };
    }

    private async getSharesPerAmbassador(
        merchantId: string,
        ambassadorIds: string[]
    ): Promise<Array<{ identityGroupId: string; shares: number }>> {
        const rows = await db
            .select({
                identityGroupId: interactionLogsTable.identityGroupId,
                shares: sql<string>`COUNT(*)`,
            })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.merchantId, merchantId),
                    eq(interactionLogsTable.type, "create_referral_link"),
                    isNull(interactionLogsTable.cancelledAt),
                    inArray(interactionLogsTable.identityGroupId, ambassadorIds)
                )
            )
            .groupBy(interactionLogsTable.identityGroupId);

        return rows
            .filter(
                (r): r is { identityGroupId: string; shares: string } =>
                    r.identityGroupId !== null
            )
            .map((r) => ({
                identityGroupId: r.identityGroupId,
                shares: toNumber(r.shares),
            }));
    }

    /**
     * Per-ambassador attributed revenue and sales — both campaign-scoped
     * via the `asset_logs → interaction_logs` bridge.
     *
     * Each `referrer` asset_log on this campaign points (via
     * `interaction_log_id`) at the purchase interaction that triggered
     * the reward. The interaction's JSONB payload carries the fiat
     * purchase amount and currency directly (set at webhook ingest),
     * so we read it inline — no `purchases`/`referral_links` join needed.
     *
     * This is the cleanest attribution we have: an ambassador only
     * contributes revenue for purchases they were actually paid out on
     * for this specific campaign. Cancelled rewards drop out via
     * `cancelled_at IS NULL`.
     */
    private async getRevenuePerAmbassador(
        campaignId: string,
        ambassadorIds: string[]
    ): Promise<
        Array<{ identityGroupId: string; revenue: number; sales: number }>
    > {
        const rows = await db
            .select({
                referrerGroupId: assetLogsTable.identityGroupId,
                revenue: sql<string>`COALESCE(SUM((${interactionLogsTable.payload}->>'amount')::NUMERIC), 0)`,
                sales: countDistinct(interactionLogsTable.id),
            })
            .from(assetLogsTable)
            .innerJoin(
                interactionLogsTable,
                eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
            )
            .where(
                and(
                    eq(assetLogsTable.campaignRuleId, campaignId),
                    eq(assetLogsTable.recipientType, "referrer"),
                    isNull(assetLogsTable.cancelledAt),
                    eq(interactionLogsTable.type, "purchase"),
                    isNull(interactionLogsTable.cancelledAt),
                    inArray(assetLogsTable.identityGroupId, ambassadorIds)
                )
            )
            .groupBy(assetLogsTable.identityGroupId);

        return rows.map((r) => ({
            identityGroupId: r.referrerGroupId,
            revenue: toNumber(r.revenue),
            sales: toNumber(r.sales),
        }));
    }

    /**
     * Stitches SQL results into the response shape and computes all
     * derived ratios. Centralising the math in one place keeps the SQL
     * branches above purely declarative.
     */
    private assembleResponse(input: {
        currency: string;
        campaignRollup: {
            spend: number;
            ambassadorAmount: number;
            refereeAmount: number;
            conversions: number;
            ambassadorsTotal: number;
            attributedGMV: number;
        };
        leaderboard: {
            rows: Array<{
                wallet: Address;
                earned: number;
                shares: number;
                sales: number;
                revenue: number;
            }>;
            totalRevenue: number;
        };
        totalReferees: number;
        convertedReferees: number;
        interactingUsers: number;
    }): CampaignDetailsResponse {
        const {
            currency,
            campaignRollup,
            leaderboard,
            totalReferees,
            convertedReferees,
            interactingUsers,
        } = input;

        const cpa = safeRatio(campaignRollup.spend, campaignRollup.conversions);
        const avgBasketValue = safeRatio(
            campaignRollup.attributedGMV,
            campaignRollup.conversions
        );
        const metaCpa = metaCpaForCurrency(currency);
        const metaEquivalentCost = metaCpa * campaignRollup.conversions;
        const savedVsMeta = Math.max(
            0,
            metaEquivalentCost - campaignRollup.spend
        );
        const cheaperPct = safeRatio(savedVsMeta, metaEquivalentCost);

        const segments = buildCpaSegments({
            cpaTotal: cpa,
            ambassadorAmount: campaignRollup.ambassadorAmount,
            refereeAmount: campaignRollup.refereeAmount,
        });

        // Ambassador-conversion rate: of everyone who interacted with the
        // merchant, what share earned a referrer reward on this campaign.
        // The "Shared at least once" FE sub-label is a soft misnomer —
        // the real signal is "became a paying ambassador here".
        const activePct = safeRatio(
            campaignRollup.ambassadorsTotal,
            interactingUsers
        );

        const refereesConvertedPct = safeRatio(
            convertedReferees,
            totalReferees
        );

        // True campaign ROI = total attributed GMV / total reward spend.
        // Previous draft used the top-10 leaderboard `totalRevenue` as
        // numerator, which under-counted whenever there were more than
        // 10 earning ambassadors. `attributedGMV` is the exhaustive sum.
        const roi = safeRatio(
            campaignRollup.attributedGMV,
            campaignRollup.spend
        );
        const avgReward = safeRatio(
            campaignRollup.spend,
            campaignRollup.ambassadorsTotal
        );

        const top = leaderboard.rows[0];
        // topPerformerPct is still scoped to the leaderboard's share of
        // revenue, NOT campaign-wide GMV. Reads as "of the top 10
        // ambassadors' revenue, X% comes from #1" — useful for spotting
        // power-user concentration without conflating with the long tail.
        const topPerformerPct = top
            ? safeRatio(top.revenue, leaderboard.totalRevenue)
            : 0;
        const topPerformerWallet = top ? top.wallet : zeroAddress;

        return {
            economicValue: {
                currency,
                spend: campaignRollup.spend,
                conversions: campaignRollup.conversions,
                cpa,
                attributedGMV: campaignRollup.attributedGMV,
                avgBasketValue,
                metaEquivalentCost,
                metaCpa,
                savedVsMeta,
                cheaperPct,
            },
            cpaBreakdown: {
                currency,
                total: cpa,
                segments,
            },
            ambassadorStats: {
                total: campaignRollup.ambassadorsTotal,
                activePct,
                refereesConvertedPct,
            },
            topAmbassadors: leaderboard.rows,
            efficiency: {
                currency,
                roi,
                avgReward,
                topPerformerPct,
                topPerformerWallet,
            },
        };
    }
}

/**
 * Per-currency variant of the USD CASE expression in `utils/usdRewards.ts`.
 * `prices` maps token address → fiat spot price in the requested currency;
 * unknown tokens fall through to `0`. Kept inline (rather than pushed into
 * `usdRewards.ts`) so the existing USD helper stays a clean one-liner.
 */
function buildFiatRewardsExpression(prices: Map<string, number>): SQL {
    if (prices.size === 0) return sql`0`;
    const whenClauses: SQL[] = [];
    for (const [token, fiatPrice] of prices) {
        whenClauses.push(
            sql`WHEN ${eq(assetLogsTable.tokenAddress, token as Address)} THEN ${assetLogsTable.amount}::NUMERIC * ${fiatPrice}`
        );
    }
    return sql`CASE ${sql.join(whenClauses, sql` `)} ELSE 0 END`;
}

function pickFiatPrice(
    price: { eur: number; usd: number; gbp: number },
    currency: string
): number | undefined {
    switch (currency.toUpperCase()) {
        case "EUR":
            return price.eur;
        case "USD":
            return price.usd;
        case "GBP":
            return price.gbp;
        default:
            return price.eur;
    }
}

/**
 * Build the three-segment CPA breakdown.
 *
 * The Frak platform fee is an overlay (no `platform` recipient_type
 * exists in the schema yet — see `campaignBenchmarks.ts`). We compute
 * `frak = total × fee` and then scale the real ambassador/referee
 * amounts so all three segments sum to `total` exactly. When there's no
 * real referrer/referee spend on the campaign we degrade gracefully:
 * `frak` still appears at the configured fee share, the other two split
 * the remainder evenly.
 */
function buildCpaSegments(input: {
    cpaTotal: number;
    ambassadorAmount: number;
    refereeAmount: number;
}): Array<{ key: CpaSegmentKey; pct: number; amount: number }> {
    const { cpaTotal, ambassadorAmount, refereeAmount } = input;

    if (cpaTotal === 0) {
        return [
            { key: "frak", pct: PLATFORM_FEE_PCT, amount: 0 },
            { key: "ambassador", pct: (1 - PLATFORM_FEE_PCT) / 2, amount: 0 },
            { key: "referee", pct: (1 - PLATFORM_FEE_PCT) / 2, amount: 0 },
        ];
    }

    const frakPct = PLATFORM_FEE_PCT;
    const recipientTotal = ambassadorAmount + refereeAmount;

    const ambassadorPct =
        recipientTotal > 0
            ? (1 - frakPct) * (ambassadorAmount / recipientTotal)
            : (1 - frakPct) / 2;
    const refereePct =
        recipientTotal > 0
            ? (1 - frakPct) * (refereeAmount / recipientTotal)
            : (1 - frakPct) / 2;

    return [
        { key: "frak", pct: frakPct, amount: cpaTotal * frakPct },
        {
            key: "ambassador",
            pct: ambassadorPct,
            amount: cpaTotal * ambassadorPct,
        },
        { key: "referee", pct: refereePct, amount: cpaTotal * refereePct },
    ];
}

function safeRatio(num: number, denom: number): number {
    if (!denom || !Number.isFinite(num) || !Number.isFinite(denom)) return 0;
    const value = num / denom;
    return Number.isFinite(value) ? value : 0;
}

function toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * The `MAX(identity_value::text)` aggregate above returns the wallet as
 * either a `0x…` hex string or `null` if no wallet node exists for the
 * group. Some drivers will surface it as a `Buffer` when the underlying
 * column is bytea — guard against both shapes.
 */
function normaliseWallet(value: Buffer | string | null): Address {
    if (!value) return zeroAddress;
    if (typeof value === "string") {
        try {
            return getAddress(value);
        } catch {
            return zeroAddress;
        }
    }
    try {
        return getAddress(bytesToHex(value));
    } catch {
        return zeroAddress;
    }
}
