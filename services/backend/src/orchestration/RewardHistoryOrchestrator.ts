import type { TokenMetadata, TokenPrice } from "@backend-infrastructure";
import type { Address } from "viem";
import type { ReferralLinkRepository } from "../domain/attribution/repositories/ReferralLinkRepository";
import type { ReferralLinkSourceData } from "../domain/attribution/schemas";
import type { IdentityRepository } from "../domain/identity";
import type { PurchaseRepository } from "../domain/purchases/repositories/PurchaseRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type {
    PurchaseAmountMap,
    ReferrerPurchaseMap,
    RewardEnrichmentData,
    RewardHistoryService,
} from "../domain/rewards/services/RewardHistoryService";
import type { DetailedAssetLog } from "../domain/rewards/types";
import type { BalancesRepository } from "../domain/wallet/repositories/BalancesRepository";
import type { PricingRepository } from "../infrastructure/pricing/PricingRepository";

export class RewardHistoryOrchestrator {
    constructor(
        readonly assetLogRepository: AssetLogRepository,
        readonly identityRepository: IdentityRepository,
        readonly purchaseRepository: PurchaseRepository,
        readonly balancesRepository: BalancesRepository,
        readonly pricingRepository: PricingRepository,
        readonly rewardHistoryService: RewardHistoryService,
        readonly referralLinkRepository: ReferralLinkRepository,
        readonly interactionLogRepository: InteractionLogRepository
    ) {}

    async getHistory(
        walletAddress: Address,
        options: { limit: number; offset: number }
    ) {
        const group = await this.identityRepository.findGroupByIdentity({
            type: "wallet",
            value: walletAddress,
        });

        if (!group) {
            return { items: [], totalCount: 0 };
        }

        const [assetLogs, totalCount] = await Promise.all([
            this.assetLogRepository.findDetailedByIdentityGroup(group.id, {
                limit: options.limit,
                offset: options.offset,
            }),
            this.assetLogRepository.countByIdentityGroup(group.id),
        ]);

        if (assetLogs.length === 0) {
            return { items: [], totalCount };
        }

        const enrichment = await this.buildEnrichmentData(assetLogs);
        const items = this.rewardHistoryService.buildRewardItems(
            assetLogs,
            enrichment
        );

        return { items, totalCount };
    }

    private async buildEnrichmentData(
        assetLogs: DetailedAssetLog[]
    ): Promise<RewardEnrichmentData> {
        const uniqueTokens = [
            ...new Set(
                assetLogs
                    .map((log) => log.tokenAddress)
                    .filter((addr): addr is Address => addr !== null)
            ),
        ];

        const [
            tokenMetadata,
            tokenPrices,
            directPurchaseIds,
            referrerLogToPurchaseId,
        ] = await Promise.all([
            this.buildTokenMetadataMap(uniqueTokens),
            this.buildTokenPriceMap(uniqueTokens),
            this.collectDirectPurchaseIds(assetLogs),
            this.buildReferrerPurchaseIdMap(assetLogs),
        ]);

        const allPurchaseIds = [
            ...new Set([
                ...directPurchaseIds,
                ...referrerLogToPurchaseId.values(),
            ]),
        ];

        const purchaseLookup =
            allPurchaseIds.length > 0
                ? await this.fetchPurchaseLookup(allPurchaseIds)
                : (new Map() as PurchaseAmountMap);

        const referrerPurchases: ReferrerPurchaseMap = new Map();
        for (const [logId, purchaseId] of referrerLogToPurchaseId) {
            const purchase = purchaseLookup.get(purchaseId);
            if (purchase) {
                referrerPurchases.set(logId, { purchaseId, ...purchase });
            }
        }

        return {
            tokenMetadata,
            tokenPrices,
            purchaseAmounts: purchaseLookup,
            referrerPurchases,
        };
    }

    private async buildTokenMetadataMap(
        uniqueTokens: Address[]
    ): Promise<Map<Address, TokenMetadata>> {
        try {
            const batchResult =
                await this.balancesRepository.getTokenMetadataBatch(
                    uniqueTokens
                );
            return batchResult;
        } catch {
            return new Map(
                uniqueTokens.map((token) => [
                    token,
                    { symbol: "UNKNOWN", decimals: 18, name: "Unknown Token" },
                ])
            );
        }
    }

    private async buildTokenPriceMap(
        uniqueTokens: Address[]
    ): Promise<Map<string, TokenPrice | undefined>> {
        const results = await Promise.all(
            uniqueTokens.map(async (token) => ({
                token,
                price: await this.pricingRepository.getTokenPrice({ token }),
            }))
        );

        return new Map(results.map(({ token, price }) => [token, price]));
    }

    private collectDirectPurchaseIds(
        assetLogs: readonly DetailedAssetLog[]
    ): string[] {
        const purchaseIds: string[] = [];
        for (const log of assetLogs) {
            if (
                log.interactionPayload &&
                "purchaseId" in log.interactionPayload &&
                log.interactionPayload.purchaseId
            ) {
                purchaseIds.push(log.interactionPayload.purchaseId);
            }
        }
        return purchaseIds;
    }

    private async fetchPurchaseLookup(
        purchaseIds: string[]
    ): Promise<PurchaseAmountMap> {
        const purchases = await this.purchaseRepository.findByIds(purchaseIds);
        return new Map(
            purchases.map((p) => [
                p.id,
                { totalPrice: p.totalPrice, currencyCode: p.currencyCode },
            ])
        );
    }

    /**
     * Map referrer-recipient asset logs back to the originating sharing
     * event's purchase id (i.e. "this reward came from your share of
     * purchase X").
     *
     * Resolution path: asset_log → referral_links.sourceData.sharedAt →
     * create_referral_link interaction with matching `sharingTimestamp` →
     * payload.purchaseId.
     *
     * Only `source='link'` referral edges carry a `sharedAt` timestamp; code
     * redemptions and links without an embedded share timestamp are
     * intentionally skipped.
     */
    private async buildReferrerPurchaseIdMap(
        assetLogs: readonly DetailedAssetLog[]
    ): Promise<Map<string, string>> {
        const referrerLogs = assetLogs.filter(
            (log) => log.recipientType === "referrer" && log.referralLinkId
        );

        if (referrerLogs.length === 0) return new Map();

        const linkMap = await this.fetchReferralLinkMap(referrerLogs);
        const groupedLogs = this.groupLogsByTimestamp(referrerLogs, linkMap);
        if (groupedLogs.size === 0) return new Map();

        const payloadsByGroup = await this.fetchSharingPayloads(groupedLogs);
        return this.mapLogsToPurchaseIds(groupedLogs, payloadsByGroup);
    }

    private async fetchReferralLinkMap(logs: readonly DetailedAssetLog[]) {
        const linkIds = [
            ...new Set(
                logs
                    .map((log) => log.referralLinkId)
                    .filter((id): id is string => id !== null)
            ),
        ];
        const links = await this.referralLinkRepository.findManyByIds(linkIds);
        return new Map(links.map((link) => [link.id, link]));
    }

    private groupLogsByTimestamp(
        logs: readonly DetailedAssetLog[],
        linkMap: ReturnType<
            RewardHistoryOrchestrator["fetchReferralLinkMap"]
        > extends Promise<infer R>
            ? R
            : never
    ): Map<string, { logs: DetailedAssetLog[]; timestamps: number[] }> {
        const grouped = new Map<
            string,
            { logs: DetailedAssetLog[]; timestamps: number[] }
        >();

        for (const log of logs) {
            if (!log.referralLinkId) continue;
            const link = linkMap.get(log.referralLinkId);
            if (!link) continue;

            const sourceData = link.sourceData as ReferralLinkSourceData | null;
            if (!sourceData || sourceData.type !== "link") continue;
            if (!sourceData.sharedAt) continue;

            const key = `${log.identityGroupId}:${log.merchantId}`;
            const group = grouped.get(key) ?? { logs: [], timestamps: [] };
            group.logs.push(log);
            group.timestamps.push(sourceData.sharedAt);
            grouped.set(key, group);
        }

        return grouped;
    }

    private async fetchSharingPayloads(
        groupedLogs: Map<
            string,
            { logs: DetailedAssetLog[]; timestamps: number[] }
        >
    ) {
        const results = await Promise.all(
            [...groupedLogs.entries()].map(async ([key, group]) => {
                const [identityGroupId, merchantId] = key.split(":") as [
                    string,
                    string,
                ];
                const payloads =
                    await this.interactionLogRepository.findSharingInteractionsByTimestamps(
                        {
                            identityGroupId,
                            merchantId,
                            sharingTimestamps: [...new Set(group.timestamps)],
                        }
                    );
                return [key, payloads] as const;
            })
        );
        return new Map(results);
    }

    private mapLogsToPurchaseIds(
        groupedLogs: Map<
            string,
            { logs: DetailedAssetLog[]; timestamps: number[] }
        >,
        payloadsByGroup: Map<
            string,
            Awaited<
                ReturnType<
                    InteractionLogRepository["findSharingInteractionsByTimestamps"]
                >
            >
        >
    ): Map<string, string> {
        const logToPurchaseId = new Map<string, string>();

        for (const [key, group] of groupedLogs) {
            const payloads = payloadsByGroup.get(key);
            if (!payloads) continue;

            for (let i = 0; i < group.logs.length; i++) {
                const log = group.logs[i];
                const timestamp = group.timestamps[i];
                if (!log || timestamp === undefined) continue;
                const sharingPayload = payloads.get(timestamp);
                if (sharingPayload?.purchaseId) {
                    logToPurchaseId.set(log.id, sharingPayload.purchaseId);
                }
            }
        }

        return logToPurchaseId;
    }
}
