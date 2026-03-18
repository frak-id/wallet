import type { TokenPrice } from "@backend-infrastructure";
import type { Address } from "viem";
import type { TouchpointRepository } from "../domain/attribution/repositories/TouchpointRepository";
import type { TouchpointSourceData } from "../domain/attribution/schemas";
import type { IdentityRepository } from "../domain/identity";
import type { PurchaseRepository } from "../domain/purchases/repositories/PurchaseRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type {
    PurchaseAmountMap,
    ReferrerPurchaseMap,
    RewardEnrichmentData,
    RewardHistoryService,
    TokenMeta,
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
        readonly touchpointRepository: TouchpointRepository,
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
    ): Promise<Map<string, TokenMeta>> {
        const results = await Promise.all(
            uniqueTokens.map(async (token) => ({
                token,
                metadata: await this.fetchTokenMetadata(token),
            }))
        );

        return new Map(results.map(({ token, metadata }) => [token, metadata]));
    }

    private async fetchTokenMetadata(
        tokenAddress: Address
    ): Promise<TokenMeta> {
        try {
            const metadata = await this.balancesRepository.getTokenMetadata({
                token: tokenAddress,
            });
            return { symbol: metadata.symbol, decimals: metadata.decimals };
        } catch {
            return { symbol: "UNKNOWN", decimals: 18 };
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

    private async buildReferrerPurchaseIdMap(
        assetLogs: readonly DetailedAssetLog[]
    ): Promise<Map<string, string>> {
        const referrerLogs = assetLogs.filter(
            (log) => log.recipientType === "referrer" && log.touchpointId
        );

        if (referrerLogs.length === 0) return new Map();

        const touchpointMap = await this.fetchTouchpointMap(referrerLogs);
        const groupedLogs = this.groupLogsByTimestamp(
            referrerLogs,
            touchpointMap
        );
        if (groupedLogs.size === 0) return new Map();

        const payloadsByGroup = await this.fetchSharingPayloads(groupedLogs);
        return this.mapLogsToPurchaseIds(groupedLogs, payloadsByGroup);
    }

    private async fetchTouchpointMap(logs: readonly DetailedAssetLog[]) {
        const touchpointIds = [
            ...new Set(
                logs
                    .map((log) => log.touchpointId)
                    .filter((id): id is string => id !== null)
            ),
        ];
        const touchpoints =
            await this.touchpointRepository.findByIds(touchpointIds);
        return new Map(touchpoints.map((tp) => [tp.id, tp]));
    }

    private groupLogsByTimestamp(
        logs: readonly DetailedAssetLog[],
        touchpointMap: ReturnType<
            RewardHistoryOrchestrator["fetchTouchpointMap"]
        > extends Promise<infer R>
            ? R
            : never
    ): Map<string, { logs: DetailedAssetLog[]; timestamps: number[] }> {
        const grouped = new Map<
            string,
            { logs: DetailedAssetLog[]; timestamps: number[] }
        >();

        for (const log of logs) {
            if (!log.touchpointId) continue;
            const touchpoint = touchpointMap.get(log.touchpointId);
            if (!touchpoint) continue;

            const sourceData = touchpoint.sourceData as TouchpointSourceData;
            if (sourceData.type !== "referral_link") continue;
            if (!("v" in sourceData) || sourceData.v !== 2) continue;
            if (!sourceData.referralTimestamp) continue;

            const key = `${log.identityGroupId}:${log.merchantId}`;
            const group = grouped.get(key) ?? { logs: [], timestamps: [] };
            group.logs.push(log);
            group.timestamps.push(sourceData.referralTimestamp);
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
