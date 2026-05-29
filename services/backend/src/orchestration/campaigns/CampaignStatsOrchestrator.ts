import { toNumber } from "@backend-utils";
import {
    and,
    countDistinct,
    eq,
    inArray,
    isNull,
    type SQL,
    sql,
    sum,
} from "drizzle-orm";
import { type Address, bytesToHex, getAddress } from "viem";
import { referralLinksTable } from "../../domain/attribution/db/schema";
import { campaignRulesTable } from "../../domain/campaign";
import { identityNodesTable } from "../../domain/identity/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";
import { db } from "../../infrastructure/persistence/postgres";
import type { PricingRepository } from "../../infrastructure/pricing/PricingRepository";
import type { CampaignDetailsResponse } from "../schemas/campaignDetailsSchemas";
import type { CampaignStatsItem } from "../schemas/campaignStatsSchemas";
import {
    buildDetailsResponse,
    buildStatsItem,
    normaliseWallet,
} from "./assembly";
import {
    distinctCampaignPurchases,
    distinctPurchases,
    walletIdentityJoinOn,
} from "./queries";
import {
    buildRewardsExpression,
    type FiatCurrency,
    getTokenPrices,
} from "./rewards";

/** Top-N cap on the ambassador leaderboard. */
const TOP_AMBASSADORS_LIMIT = 10;

/**
 * Cross-domain per-campaign reporting (rewards + identity + attribution
 * + campaign). Lives in orchestration because the queries span four
 * domains; the pure data shaping is in `assembly.ts` so this class is
 * SQL + coordination only.
 *
 *  - `getStatsForMerchant` → `GET /campaigns` per-row `stats` (lifetime,
 *    token-denominated).
 *  - `getDetailsForCampaign` → `GET /campaigns/:id/details` (lifetime,
 *    fiat-denominated).
 */
export class CampaignStatsOrchestrator {
    constructor(private readonly pricingRepository: PricingRepository) {}

    // ---- list stats ----------------------------------------------------

    async getStatsForMerchant(
        merchantId: string
    ): Promise<CampaignStatsItem[]> {
        const campaignIds = await this.getCampaignIds(merchantId);
        if (campaignIds.length === 0) return [];

        const [interactions, assets, revenue] = await Promise.all([
            this.getInteractionCountsByCampaign(merchantId, campaignIds),
            this.getAssetAggregatesByCampaign(campaignIds),
            this.getAttributedRevenueByCampaign(merchantId, campaignIds),
        ]);

        return campaignIds.map((campaignId) => {
            const i = interactions.get(campaignId);
            const a = assets.get(campaignId);
            return buildStatsItem({
                campaignId,
                tokenAddress: a?.tokenAddress ?? null,
                referredInteractions: i?.referredInteractions ?? 0,
                purchaseInteractions: i?.purchaseInteractions ?? 0,
                createReferralLinkInteractions:
                    i?.createReferralLinkInteractions ?? 0,
                totalRewards: Number.parseFloat(a?.totalRewards ?? "0"),
                attributedRevenue: revenue.get(campaignId) ?? 0,
                uniqueWallets: a?.uniqueWallets ?? 0,
            });
        });
    }

    private async getCampaignIds(merchantId: string): Promise<string[]> {
        const rows = await db
            .select({ id: campaignRulesTable.id })
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.merchantId, merchantId));
        return rows.map((r) => r.id);
    }

    /**
     * Interaction logs have no `campaignRuleId` column — bridge through
     * `asset_logs` to attribute counts per campaign.
     */
    private async getInteractionCountsByCampaign(
        merchantId: string,
        campaignIds: string[]
    ): Promise<
        Map<
            string,
            {
                referredInteractions: number;
                purchaseInteractions: number;
                createReferralLinkInteractions: number;
            }
        >
    > {
        const rows = await db
            .select({
                campaignRuleId: assetLogsTable.campaignRuleId,
                referredInteractions: sql<number>`COUNT(DISTINCT CASE WHEN ${interactionLogsTable.type} = 'referral_arrival' THEN ${interactionLogsTable.id} END)`,
                purchaseInteractions: sql<number>`COUNT(DISTINCT CASE WHEN ${interactionLogsTable.type} = 'purchase' THEN ${interactionLogsTable.id} END)`,
                createReferralLinkInteractions: sql<number>`COUNT(DISTINCT CASE WHEN ${interactionLogsTable.type} = 'create_referral_link' THEN ${interactionLogsTable.id} END)`,
            })
            .from(assetLogsTable)
            .leftJoin(
                interactionLogsTable,
                eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
            )
            .where(
                and(
                    eq(assetLogsTable.merchantId, merchantId),
                    inArray(assetLogsTable.campaignRuleId, campaignIds)
                )
            )
            .groupBy(assetLogsTable.campaignRuleId);

        const result = new Map<
            string,
            {
                referredInteractions: number;
                purchaseInteractions: number;
                createReferralLinkInteractions: number;
            }
        >();
        for (const row of rows) {
            if (!row.campaignRuleId) continue;
            result.set(row.campaignRuleId, {
                referredInteractions: toNumber(row.referredInteractions),
                purchaseInteractions: toNumber(row.purchaseInteractions),
                createReferralLinkInteractions: toNumber(
                    row.createReferralLinkInteractions
                ),
            });
        }
        return result;
    }

    /**
     * Per-campaign attributed revenue. `distinctCampaignPurchases` dedupes
     * on `(campaignRuleId, interactionLogId, amount)` so the same purchase
     * basket only counts once per campaign that rewarded it.
     */
    private async getAttributedRevenueByCampaign(
        merchantId: string,
        campaignIds: string[]
    ): Promise<Map<string, number>> {
        const purchases = distinctCampaignPurchases([
            eq(assetLogsTable.merchantId, merchantId),
            inArray(assetLogsTable.campaignRuleId, campaignIds),
        ]);

        const rows = await db
            .select({
                campaignRuleId: purchases.campaignRuleId,
                attributedRevenue: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
            })
            .from(purchases)
            .groupBy(purchases.campaignRuleId);

        const result = new Map<string, number>();
        for (const row of rows) {
            if (!row.campaignRuleId) continue;
            result.set(row.campaignRuleId, toNumber(row.attributedRevenue));
        }
        return result;
    }

    private async getAssetAggregatesByCampaign(campaignIds: string[]): Promise<
        Map<
            string,
            {
                totalRewards: string;
                tokenAddress: Address | null;
                uniqueWallets: number;
            }
        >
    > {
        const rows = await db
            .select({
                campaignRuleId: assetLogsTable.campaignRuleId,
                totalRewards: sql<string>`COALESCE(${sum(assetLogsTable.amount)}, '0')`,
                tokenAddress: sql<Buffer | null>`MAX(${assetLogsTable.tokenAddress}::text)::bytea`,
                uniqueWallets: countDistinct(identityNodesTable.identityValue),
            })
            .from(assetLogsTable)
            .leftJoin(identityNodesTable, walletIdentityJoinOn())
            .where(inArray(assetLogsTable.campaignRuleId, campaignIds))
            .groupBy(assetLogsTable.campaignRuleId);

        const result = new Map<
            string,
            {
                totalRewards: string;
                tokenAddress: Address | null;
                uniqueWallets: number;
            }
        >();
        for (const row of rows) {
            if (!row.campaignRuleId) continue;
            result.set(row.campaignRuleId, {
                totalRewards: row.totalRewards ?? "0",
                tokenAddress: row.tokenAddress
                    ? getAddress(bytesToHex(row.tokenAddress))
                    : null,
                uniqueWallets: toNumber(row.uniqueWallets),
            });
        }
        return result;
    }

    // ---- single-campaign details --------------------------------------

    async getDetailsForCampaign(
        merchantId: string,
        campaignId: string
    ): Promise<CampaignDetailsResponse> {
        // Currency drives token→fiat conversion downstream, so it must
        // resolve first.
        const { currency, totalReferees, convertedReferees } =
            await this.getCurrencyAndReferees(merchantId, campaignId);

        const fiatRewardsExpr = buildRewardsExpression(
            await getTokenPrices(
                this.pricingRepository,
                and(
                    eq(assetLogsTable.campaignRuleId, campaignId),
                    isNull(assetLogsTable.cancelledAt)
                ) as SQL,
                currency as FiatCurrency
            )
        );

        const [rollup, leaderboard, interactingUsers] = await Promise.all([
            this.getCampaignRollup(campaignId, fiatRewardsExpr),
            this.getLeaderboard(merchantId, campaignId, fiatRewardsExpr),
            this.getInteractingUsersCount(merchantId),
        ]);

        return buildDetailsResponse({
            currency,
            ...rollup,
            leaderboard: leaderboard.rows,
            leaderboardTotalRevenue: leaderboard.totalRevenue,
            totalReferees,
            convertedReferees,
            interactingUsers,
        });
    }

    /**
     * Distinct identity_groups with ≥1 `interaction_logs` row for this
     * merchant — denominator for `ambassadorStats.activePct`.
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
                    sql`${interactionLogsTable.identityGroupId} IS NOT NULL`
                )
            );
        return toNumber(row?.count);
    }

    private async getCurrencyAndReferees(
        merchantId: string,
        campaignId: string
    ): Promise<{
        currency: string;
        totalReferees: number;
        convertedReferees: number;
    }> {
        const [converted, totalReferees] = await Promise.all([
            this.getCurrencyAndConvertedReferees(campaignId),
            this.getTotalRefereesForCampaign(merchantId, campaignId),
        ]);
        return { ...converted, totalReferees };
    }

    /**
     * Modal purchase currency on this campaign + distinct referees who
     * triggered a `referrer` reward. Currency is the MODE() of
     * `interaction_logs.payload->>'currency'` across rewarded purchases.
     */
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

    /**
     * Total distinct referees brought in by any of this campaign's
     * ambassadors, including those who never bought. Denominator for
     * `refereesConvertedPct`. Raw SQL because the IN subquery is more
     * readable than the equivalent drizzle composition.
     */
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
     * Campaign-scoped roll-up: spend/conversions/ambassadors split by
     * `recipient_type`, plus attributed GMV via the deduped purchases
     * CTE.
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
        const [aggregateRow, attributedGMV] = await Promise.all([
            db
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
                )
                .then((rows) => rows[0]),
            this.getAttributedGMV(campaignId),
        ]);

        return {
            spend: toNumber(aggregateRow?.spend),
            ambassadorAmount: toNumber(aggregateRow?.ambassadorAmount),
            refereeAmount: toNumber(aggregateRow?.refereeAmount),
            conversions: toNumber(aggregateRow?.conversions),
            ambassadorsTotal: toNumber(aggregateRow?.ambassadorsTotal),
            attributedGMV,
        };
    }

    private async getAttributedGMV(campaignId: string): Promise<number> {
        const purchases = distinctPurchases([
            eq(assetLogsTable.campaignRuleId, campaignId),
        ]);
        const [row] = await db
            .select({
                gmv: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
            })
            .from(purchases);
        return toNumber(row?.gmv);
    }

    /**
     * Top-N referrer leaderboard. Split into 3 queries to avoid the
     * multi-LEFT-JOIN double-count trap: B1 anchors on
     * "ambassadors-who-earned-here", B2/B3 fetch their merchant-scoped
     * shares + campaign-scoped revenue.
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
            .leftJoin(identityNodesTable, walletIdentityJoinOn())
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

        const [shares, revenue] = await Promise.all([
            this.getSharesPerAmbassador(merchantId, ambassadorIds),
            this.getRevenuePerAmbassador(campaignId, ambassadorIds),
        ]);

        let totalRevenue = 0;
        const merged = earnedRows.map((row) => {
            const r = revenue.get(row.identityGroupId);
            totalRevenue += r?.revenue ?? 0;
            return {
                wallet: normaliseWallet(row.wallet),
                earned: toNumber(row.earned),
                shares: shares.get(row.identityGroupId) ?? 0,
                sales: r?.sales ?? 0,
                revenue: r?.revenue ?? 0,
            };
        });

        merged.sort((a, b) => b.revenue - a.revenue || b.earned - a.earned);
        return {
            rows: merged.slice(0, TOP_AMBASSADORS_LIMIT),
            totalRevenue,
        };
    }

    private async getSharesPerAmbassador(
        merchantId: string,
        ambassadorIds: string[]
    ): Promise<Map<string, number>> {
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

        const result = new Map<string, number>();
        for (const row of rows) {
            if (!row.identityGroupId) continue;
            result.set(row.identityGroupId, toNumber(row.shares));
        }
        return result;
    }

    private async getRevenuePerAmbassador(
        campaignId: string,
        ambassadorIds: string[]
    ): Promise<Map<string, { revenue: number; sales: number }>> {
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

        const result = new Map<string, { revenue: number; sales: number }>();
        for (const row of rows) {
            if (!row.referrerGroupId) continue;
            result.set(row.referrerGroupId, {
                revenue: toNumber(row.revenue),
                sales: toNumber(row.sales),
            });
        }
        return result;
    }
}
