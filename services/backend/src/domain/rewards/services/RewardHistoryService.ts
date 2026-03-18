import type { TokenPrice } from "@backend-infrastructure";
import type {
    AssetStatus,
    CreateReferralLinkPayload,
    DetailedAssetLog,
    InteractionType,
    PurchasePayload,
    RecipientType,
} from "../types";

export type TokenMeta = { symbol: string; decimals: number };
export type TokenMetadataMap = Map<string, TokenMeta>;
export type TokenPriceMap = Map<string, TokenPrice | undefined>;
export type PurchaseAmountMap = Map<
    string,
    { totalPrice: string; currencyCode: string }
>;

export type RewardEnrichmentData = {
    tokenMetadata: TokenMetadataMap;
    tokenPrices: TokenPriceMap;
    purchaseAmounts: PurchaseAmountMap;
};

export type RewardHistoryItem = {
    merchant: {
        name: string;
        domain: string;
        heroImageUrl: string | undefined;
    };
    token: {
        symbol: string;
        decimals: number;
    };
    amount: {
        amount: number;
        eurAmount: number;
        usdAmount: number;
        gbpAmount: number;
    };
    status: AssetStatus;
    role: RecipientType;
    trigger: InteractionType;
    txHash: string | undefined;
    createdAt: Date;
    settledAt: Date | undefined;
    purchase: { amount: number; currency: string } | undefined;
};

export class RewardHistoryService {
    buildRewardItems(
        assetLogs: DetailedAssetLog[],
        enrichment: RewardEnrichmentData
    ): RewardHistoryItem[] {
        return assetLogs.map((log) => this.buildRewardItem(log, enrichment));
    }

    private buildRewardItem(
        log: DetailedAssetLog,
        { tokenMetadata, tokenPrices, purchaseAmounts }: RewardEnrichmentData
    ): RewardHistoryItem {
        const meta = log.tokenAddress
            ? tokenMetadata.get(log.tokenAddress)
            : undefined;
        const price = log.tokenAddress
            ? tokenPrices.get(log.tokenAddress)
            : undefined;
        const decimals = meta?.decimals ?? 18;

        return {
            merchant: {
                name: log.merchantName,
                domain: log.merchantDomain,
                heroImageUrl:
                    log.merchantExplorerConfig?.heroImageUrl ?? undefined,
            },
            token: {
                symbol: meta?.symbol ?? "UNKNOWN",
                decimals,
            },
            amount: this.buildTokenAmount(log.amount, decimals, price),
            status: log.status,
            role: log.recipientType,
            trigger: this.getTrigger(log.interactionType),
            txHash: log.onchainTxHash ?? undefined,
            createdAt: log.createdAt,
            settledAt: log.settledAt ?? undefined,
            purchase: this.extractPurchaseInfo(log, purchaseAmounts),
        };
    }

    private buildTokenAmount(
        rawAmount: string,
        decimals: number,
        price: TokenPrice | undefined
    ) {
        const amount = Number.parseFloat(rawAmount) / 10 ** decimals;
        return {
            amount,
            eurAmount: price ? amount * price.eur : 0,
            usdAmount: price ? amount * price.usd : 0,
            gbpAmount: price ? amount * price.gbp : 0,
        };
    }

    private extractPurchaseInfo(
        log: DetailedAssetLog,
        purchaseAmounts: PurchaseAmountMap
    ): { amount: number; currency: string } | undefined {
        if (log.interactionType === "purchase" && log.interactionPayload) {
            const payload = log.interactionPayload as PurchasePayload;
            return { amount: payload.amount, currency: payload.currency };
        }

        if (
            log.interactionType === "create_referral_link" &&
            log.interactionPayload
        ) {
            const payload = log.interactionPayload as CreateReferralLinkPayload;
            if (payload.purchaseId) {
                const purchase = purchaseAmounts.get(payload.purchaseId);
                if (purchase) {
                    return {
                        amount: Number.parseFloat(purchase.totalPrice),
                        currency: purchase.currencyCode,
                    };
                }
            }
        }

        return undefined;
    }

    private getTrigger(
        interactionType: InteractionType | null
    ): InteractionType {
        return interactionType ?? "custom";
    }
}
