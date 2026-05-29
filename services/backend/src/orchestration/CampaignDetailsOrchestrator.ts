import {
    and,
    countDistinct,
    eq,
    inArray,
    isNotNull,
    isNull,
    notInArray,
    or,
    type SQL,
    sql,
} from "drizzle-orm";
import { type Address, bytesToHex, getAddress, zeroAddress } from "viem";
import { referralLinksTable } from "../domain/attribution/db/schema";
import { identityNodesTable } from "../domain/identity/db/schema";
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
        const tokenPrices = await this.getTokenFiatPrices(merchantId, currency);
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
     * Bundle C — modal purchase currency for this campaign's attributed
     * purchases, plus the unique-referee / converted-referee counts that
     * feed `ambassadorStats.refereesConvertedPct`.
     *
     * "Attributed to this campaign" is approximated as "referee of an
     * ambassador who has at least one referrer reward on this campaign".
     * Same best-effort attribution caveat as `topAmbassadors[].shares`.
     */
    private async getCurrencyAndReferees(
        merchantId: string,
        campaignId: string
    ): Promise<{
        currency: string;
        totalReferees: number;
        convertedReferees: number;
    }> {
        // Ambassadors who earned at least one referrer reward on this
        // campaign — used as the entry point for "referees of this
        // campaign's ambassadors".
        const ambassadorGroupsSql = sql`
            SELECT DISTINCT ${assetLogsTable.identityGroupId}
            FROM ${assetLogsTable}
            WHERE ${assetLogsTable.campaignRuleId} = ${campaignId}::uuid
              AND ${assetLogsTable.recipientType} = 'referrer'
              AND ${assetLogsTable.cancelledAt} IS NULL
        `;

        const refereeRows = await db.execute<{
            referee_identity_group_id: string;
        }>(sql`
            SELECT DISTINCT ${referralLinksTable.refereeIdentityGroupId} AS referee_identity_group_id
            FROM ${referralLinksTable}
            WHERE ${referralLinksTable.merchantId} = ${merchantId}::uuid
              AND ${referralLinksTable.removedAt} IS NULL
              AND ${referralLinksTable.referrerIdentityGroupId} IN (${ambassadorGroupsSql})
        `);

        const refereeIds = refereeRows
            .map((r) => r.referee_identity_group_id)
            .filter((id): id is string => !!id);

        if (refereeIds.length === 0) {
            return {
                currency: "EUR",
                totalReferees: 0,
                convertedReferees: 0,
            };
        }

        // Single scan over `purchases ⋈ merchant_webhooks` returns both
        // the modal currency and the count of referees who completed at
        // least one attributed purchase.
        const [purchaseRow] = await db
            .select({
                currency: sql<
                    string | null
                >`MODE() WITHIN GROUP (ORDER BY ${purchasesTable.currencyCode})`,
                convertedReferees: countDistinct(
                    purchasesTable.identityGroupId
                ),
            })
            .from(purchasesTable)
            .innerJoin(
                merchantWebhooksTable,
                eq(merchantWebhooksTable.id, purchasesTable.webhookId)
            )
            .where(
                and(
                    eq(merchantWebhooksTable.merchantId, merchantId),
                    inArray(purchasesTable.identityGroupId, refereeIds),
                    or(
                        isNull(purchasesTable.status),
                        notInArray(purchasesTable.status, [
                            "cancelled",
                            "refunded",
                        ])
                    )
                )
            );

        return {
            currency: purchaseRow?.currency ?? "EUR",
            totalReferees: refereeIds.length,
            convertedReferees: Number(purchaseRow?.convertedReferees ?? 0),
        };
    }

    /**
     * Look up the fiat spot price (in the requested currency) for every
     * distinct token that has been rewarded on this merchant. Tokens
     * whose price lookup fails are dropped — they contribute zero to
     * fiat aggregates via the `ELSE 0` branch of the CASE expression.
     */
    private async getTokenFiatPrices(
        merchantId: string,
        currency: string
    ): Promise<Map<string, number>> {
        const tokenRows = await db
            .selectDistinct({ tokenAddress: assetLogsTable.tokenAddress })
            .from(assetLogsTable)
            .where(eq(assetLogsTable.merchantId, merchantId));

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
     * Bundle A — campaign-scoped roll-up. Returns total spend, conversions
     * and the ambassador/referee split in a single scan over
     * `asset_logs ⋈ interaction_logs`.
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

        return {
            spend: toNumber(row?.spend),
            ambassadorAmount: toNumber(row?.ambassadorAmount),
            refereeAmount: toNumber(row?.refereeAmount),
            conversions: toNumber(row?.conversions),
            ambassadorsTotal: toNumber(row?.ambassadorsTotal),
        };
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
            this.getRevenuePerAmbassador(merchantId, ambassadorIds),
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

    private async getRevenuePerAmbassador(
        merchantId: string,
        ambassadorIds: string[]
    ): Promise<
        Array<{ identityGroupId: string; revenue: number; sales: number }>
    > {
        const rows = await db
            .select({
                referrerGroupId: referralLinksTable.referrerIdentityGroupId,
                revenue: sql<string>`COALESCE(SUM(${purchasesTable.totalPrice}::NUMERIC), 0)`,
                sales: sql<string>`COUNT(DISTINCT ${purchasesTable.id})`,
            })
            .from(referralLinksTable)
            .innerJoin(
                purchasesTable,
                eq(
                    purchasesTable.identityGroupId,
                    referralLinksTable.refereeIdentityGroupId
                )
            )
            .innerJoin(
                merchantWebhooksTable,
                eq(merchantWebhooksTable.id, purchasesTable.webhookId)
            )
            .where(
                and(
                    eq(referralLinksTable.merchantId, merchantId),
                    isNull(referralLinksTable.removedAt),
                    inArray(
                        referralLinksTable.referrerIdentityGroupId,
                        ambassadorIds
                    ),
                    eq(merchantWebhooksTable.merchantId, merchantId),
                    or(
                        isNull(purchasesTable.status),
                        notInArray(purchasesTable.status, [
                            "cancelled",
                            "refunded",
                        ])
                    ),
                    isNotNull(purchasesTable.identityGroupId)
                )
            )
            .groupBy(referralLinksTable.referrerIdentityGroupId);

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

        const roi = safeRatio(leaderboard.totalRevenue, campaignRollup.spend);
        const avgReward = safeRatio(
            campaignRollup.spend,
            campaignRollup.ambassadorsTotal
        );

        const top = leaderboard.rows[0];
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
