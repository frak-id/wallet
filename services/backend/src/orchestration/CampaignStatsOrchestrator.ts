import { and, countDistinct, eq, inArray, sql, sum } from "drizzle-orm";
import { type Address, bytesToHex, getAddress } from "viem";
import type { CampaignRuleSelect } from "../domain/campaign/db/schema";
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
            .select()
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

        return campaigns.map((campaign) =>
            this.buildStatsItem(
                campaign,
                interactionMap.get(campaign.id),
                assetMap.get(campaign.id)
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
     */
    private async aggregateInteractions(
        merchantId: string,
        campaignIds: string[]
    ): Promise<InteractionCountRow[]> {
        const rows = await db
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
            .groupBy(assetLogsTable.campaignRuleId);

        return rows
            .filter((r): r is InteractionCountRow => r.campaignRuleId !== null)
            .map((r) => ({
                campaignRuleId: r.campaignRuleId,
                referredInteractions: Number(r.referredInteractions),
                purchaseInteractions: Number(r.purchaseInteractions),
                createReferralLinkInteractions: Number(
                    r.createReferralLinkInteractions
                ),
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
                    sql`${identityNodesTable.merchantId} IS NULL`
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
        campaign: CampaignRuleSelect,
        interactions: InteractionCountRow | undefined,
        assets: AssetAggRow | undefined
    ): CampaignStatsItem {
        const referred = interactions?.referredInteractions ?? 0;
        const purchases = interactions?.purchaseInteractions ?? 0;
        const totalRewards = Number.parseFloat(assets?.totalRewards ?? "0");
        const uniqueWallets = assets?.uniqueWallets ?? 0;

        const createReferredLinkInteractions =
            interactions?.createReferralLinkInteractions ?? 0;

        const sharingRate =
            referred > 0 ? createReferredLinkInteractions / referred : 0;

        const ctr =
            createReferredLinkInteractions > 0
                ? referred / createReferredLinkInteractions
                : 0;

        const costPerShare =
            createReferredLinkInteractions > 0
                ? totalRewards / createReferredLinkInteractions
                : 0;

        const costPerPurchase = purchases > 0 ? totalRewards / purchases : 0;

        let ambassador = uniqueWallets - referred;
        if (ambassador <= 0) {
            ambassador = referred > 0 ? 1 : 0;
        }

        return {
            campaignId: campaign.id,
            campaignName: campaign.name,
            trigger: campaign.rule.trigger,
            tokenAddress: assets?.tokenAddress ?? null,
            referredInteractions: referred,
            purchaseInteractions: purchases,
            totalRewards,
            uniqueWallets,
            ambassador,
            sharingRate,
            ctr,
            costPerPurchase,
            costPerShare,
        };
    }
}
