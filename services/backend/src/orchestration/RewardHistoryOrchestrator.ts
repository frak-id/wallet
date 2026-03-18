import type { TokenPrice } from "@backend-infrastructure";
import type { Address } from "viem";
import type { IdentityRepository } from "../domain/identity";
import type { PurchaseRepository } from "../domain/purchases/repositories/PurchaseRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type {
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
        readonly rewardHistoryService: RewardHistoryService
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

        const [tokenMetadata, tokenPrices, purchaseAmounts] = await Promise.all(
            [
                this.buildTokenMetadataMap(uniqueTokens),
                this.buildTokenPriceMap(uniqueTokens),
                this.buildPurchaseAmountMap(assetLogs),
            ]
        );

        return { tokenMetadata, tokenPrices, purchaseAmounts };
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

    private async buildPurchaseAmountMap(
        assetLogs: readonly DetailedAssetLog[]
    ): Promise<Map<string, { totalPrice: string; currencyCode: string }>> {
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

        if (purchaseIds.length === 0) return new Map();

        const purchases = await this.purchaseRepository.findByIds(purchaseIds);
        return new Map(
            purchases.map((p) => [
                p.id,
                { totalPrice: p.totalPrice, currencyCode: p.currencyCode },
            ])
        );
    }
}
