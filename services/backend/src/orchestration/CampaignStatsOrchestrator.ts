import { and, countDistinct, eq, inArray, sql, sum } from "drizzle-orm";
import { type Address, bytesToHex, getAddress } from "viem";
import { campaignRulesTable } from "../domain/campaign/db/schema";
import { identityNodesTable } from "../domain/identity/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../domain/rewards/db/schema";
import { db } from "../infrastructure/persistence/postgres";
import type { CampaignStatsItem } from "./schemas/campaignStatsSchemas";

type InteractionCountRow = {
    campaignRuleId: string;
    referredInteractions: number;
    purchaseInteractions: number;
    createReferralLinkInteractions: number;
    attributedRevenue: number;
};

type AssetAggRow = {
    campaignRuleId: string;
    totalRewards: string;
    tokenAddress: Address | null;
    uniqueWallets: number;
};

export class CampaignStatsOrchestrator {
    async getStatsForMerchant(
        merchantId: string
    ): Promise<CampaignStatsItem[]> {
        const campaigns = await db
            .select({ id: campaignRulesTable.id })
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.merchantId, merchantId));

        if (campaigns.length === 0) return [];

        const campaignIds = campaigns.map((c) => c.id);

        const [interactionCounts, assetAggs] = await Promise.all([
            this.aggregateInteractions(merchantId, campaignIds),
            this.aggregateAssets(campaignIds),
        ]);

        const interactionMap = new Map(
            interactionCounts.map((r) => [r.campaignRuleId, r])
        );
        const assetMap = new Map(assetAggs.map((r) => [r.campaignRuleId, r]));

        return campaignIds.map((campaignId) =>
            this.buildStatsItem(
                campaignId,
                interactionMap.get(campaignId),
                assetMap.get(campaignId)
            )
        );
    }

    /**
     * Interaction logs don't have a direct campaignRuleId column.
     * We join through asset_logs (which links interactionLogId → campaignRuleId)
     * to attribute interaction counts per campaign.
     *
     * For interactions that didn't generate rewards (no asset_log entry),
     * we fall back to counting interaction_logs by merchantId + type directly,
     * but those can't be attributed to a specific campaign.
     *
     * Strategy: use asset_logs as the bridge table since it has both
     * campaignRuleId and interactionLogId.
     *
     * `attributedRevenue` is the basket value (`payload->>'amount'`)
     * summed across each purchase interaction attributed to the
     * campaign. To avoid double-counting when one purchase produced
     * several asset_logs rows (multi-recipient / multi-depth rewards),
     * a dedicated `SELECT DISTINCT` subquery collapses the
     * (interactionLogId, amount) pairs before SUMming.
     */
    private async aggregateInteractions(
        merchantId: string,
        campaignIds: string[]
    ): Promise<InteractionCountRow[]> {
        const [countRows, revenueRows] = await Promise.all([
            db
                .select({
                    campaignRuleId: assetLogsTable.campaignRuleId,
                    referredInteractions:
                        sql<number>`COUNT(DISTINCT CASE WHEN ${interactionLogsTable.type} = 'referral_arrival' THEN ${interactionLogsTable.id} END)`.as(
                            "referred_interactions"
                        ),
                    purchaseInteractions:
                        sql<number>`COUNT(DISTINCT CASE WHEN ${interactionLogsTable.type} = 'purchase' THEN ${interactionLogsTable.id} END)`.as(
                            "purchase_interactions"
                        ),
                    createReferralLinkInteractions:
                        sql<number>`COUNT(DISTINCT CASE WHEN ${interactionLogsTable.type} = 'create_referral_link' THEN ${interactionLogsTable.id} END)`.as(
                            "create_referral_link_interactions"
                        ),
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
                .groupBy(assetLogsTable.campaignRuleId),
            this.aggregateAttributedRevenue(merchantId, campaignIds),
        ]);

        const revenueByCampaign = new Map(
            revenueRows.map((r) => [r.campaignRuleId, r.attributedRevenue])
        );

        return countRows
            .filter(
                (r): r is typeof r & { campaignRuleId: string } =>
                    r.campaignRuleId !== null
            )
            .map((r) => ({
                campaignRuleId: r.campaignRuleId,
                referredInteractions: Number(r.referredInteractions),
                purchaseInteractions: Number(r.purchaseInteractions),
                createReferralLinkInteractions: Number(
                    r.createReferralLinkInteractions
                ),
                attributedRevenue: revenueByCampaign.get(r.campaignRuleId) ?? 0,
            }));
    }

    /**
     * Per-campaign sum of attributed basket value. `SELECT DISTINCT`
     * on `(interaction_log_id, amount)` collapses multi-recipient and
     * multi-depth reward rows so the same purchase basket only counts
     * once per campaign.
     */
    private async aggregateAttributedRevenue(
        merchantId: string,
        campaignIds: string[]
    ): Promise<Array<{ campaignRuleId: string; attributedRevenue: number }>> {
        const distinctPurchases = db
            .selectDistinct({
                campaignRuleId: assetLogsTable.campaignRuleId,
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
                    eq(assetLogsTable.merchantId, merchantId),
                    inArray(assetLogsTable.campaignRuleId, campaignIds),
                    sql`${assetLogsTable.cancelledAt} IS NULL`,
                    eq(interactionLogsTable.type, "purchase"),
                    sql`${interactionLogsTable.cancelledAt} IS NULL`
                )
            )
            .as("distinct_purchases");

        const rows = await db
            .select({
                campaignRuleId: distinctPurchases.campaignRuleId,
                attributedRevenue: sql<string>`COALESCE(SUM(${distinctPurchases.amount}), 0)`,
            })
            .from(distinctPurchases)
            .groupBy(distinctPurchases.campaignRuleId);

        return rows
            .filter(
                (r): r is typeof r & { campaignRuleId: string } =>
                    r.campaignRuleId !== null
            )
            .map((r) => ({
                campaignRuleId: r.campaignRuleId,
                attributedRevenue: Number(r.attributedRevenue) || 0,
            }));
    }

    private async aggregateAssets(
        campaignIds: string[]
    ): Promise<AssetAggRow[]> {
        const rows = await db
            .select({
                campaignRuleId: assetLogsTable.campaignRuleId,
                totalRewards:
                    sql<string>`COALESCE(${sum(assetLogsTable.amount)}, '0')`.as(
                        "total_rewards"
                    ),
                tokenAddress:
                    sql<Buffer | null>`MAX(${assetLogsTable.tokenAddress}::text)::bytea`.as(
                        "token_address"
                    ),
                uniqueWallets: countDistinct(
                    identityNodesTable.identityValue
                ).as("unique_wallets"),
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
            .where(inArray(assetLogsTable.campaignRuleId, campaignIds))
            .groupBy(assetLogsTable.campaignRuleId);

        return rows
            .filter((r) => r.campaignRuleId !== null)
            .map(
                (r) =>
                    ({
                        campaignRuleId: r.campaignRuleId,
                        totalRewards: r.totalRewards ?? "0",
                        tokenAddress: r.tokenAddress
                            ? getAddress(bytesToHex(r.tokenAddress))
                            : null,
                        uniqueWallets: Number(r.uniqueWallets),
                    }) as AssetAggRow
            );
    }

    private buildStatsItem(
        campaignId: string,
        interactions: InteractionCountRow | undefined,
        assets: AssetAggRow | undefined
    ): CampaignStatsItem {
        const referred = interactions?.referredInteractions ?? 0;
        const purchases = interactions?.purchaseInteractions ?? 0;
        const totalRewards = Number.parseFloat(assets?.totalRewards ?? "0");
        const uniqueWallets = assets?.uniqueWallets ?? 0;
        const attributedRevenue = interactions?.attributedRevenue ?? 0;
        const avgBasketValue =
            purchases > 0 ? attributedRevenue / purchases : 0;

        const createReferralLinkInteractions =
            interactions?.createReferralLinkInteractions ?? 0;

        const sharingRate =
            referred > 0 ? createReferralLinkInteractions / referred : 0;

        const ctr =
            createReferralLinkInteractions > 0
                ? referred / createReferralLinkInteractions
                : 0;

        const costPerShare =
            createReferralLinkInteractions > 0
                ? totalRewards / createReferralLinkInteractions
                : 0;

        const costPerPurchase = purchases > 0 ? totalRewards / purchases : 0;

        let ambassador = uniqueWallets - referred;
        if (ambassador <= 0) {
            ambassador = referred > 0 ? 1 : 0;
        }

        return {
            campaignId,
            tokenAddress: assets?.tokenAddress ?? null,
            referredInteractions: referred,
            purchaseInteractions: purchases,
            createReferralLinkInteractions,
            totalRewards,
            attributedRevenue,
            avgBasketValue,
            ambassador,
            sharingRate,
            ctr,
            costPerPurchase,
            costPerShare,
        };
    }
}
