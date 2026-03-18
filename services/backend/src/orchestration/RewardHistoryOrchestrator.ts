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
import type {
    CreateReferralLinkPayload,
    DetailedAssetLog,
} from "../domain/rewards/types";
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
        const groupIds =
            await this.identityRepository.findAllGroupIdsByWallet(
                walletAddress
            );

        if (groupIds.length === 0) {
            return { items: [], totalCount: 0 };
        }

        const [assetLogs, totalCount] = await Promise.all([
            this.assetLogRepository.findDetailedByIdentityGroups(groupIds, {
                limit: options.limit,
                offset: options.offset,
            }),
            this.assetLogRepository.countByIdentityGroups(groupIds),
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
        const [tokenMetadata, tokenPrices, purchaseAmounts] = await Promise.all(
            [
                this.buildTokenMetadataMap(assetLogs),
                this.buildTokenPriceMap(assetLogs),
                this.buildPurchaseAmountMap(assetLogs),
            ]
        );

        return { tokenMetadata, tokenPrices, purchaseAmounts };
    }

    private getUniqueTokenAddresses(
        assetLogs: readonly { tokenAddress: Address | null }[]
    ): Address[] {
        return [
            ...new Set(
                assetLogs
                    .map((log) => log.tokenAddress)
                    .filter((addr): addr is Address => addr !== null)
            ),
        ];
    }

    private async buildTokenMetadataMap(
        assetLogs: readonly { tokenAddress: Address | null }[]
    ): Promise<Map<string, TokenMeta>> {
        const uniqueTokens = this.getUniqueTokenAddresses(assetLogs);

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
        assetLogs: readonly { tokenAddress: Address | null }[]
    ): Promise<Map<string, TokenPrice | undefined>> {
        const uniqueTokens = this.getUniqueTokenAddresses(assetLogs);

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
                log.interactionType === "create_referral_link" &&
                log.interactionPayload
            ) {
                const payload =
                    log.interactionPayload as CreateReferralLinkPayload;
                if (payload.purchaseId) {
                    purchaseIds.push(payload.purchaseId);
                }
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
