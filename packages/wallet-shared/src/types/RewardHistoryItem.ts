import type {
    AssetStatus,
    InteractionType,
    RecipientType,
} from "@frak-labs/backend-elysia/domain/rewards/schemas";

export type { AssetStatus, InteractionType, RecipientType };

export type MerchantInfo = {
    name: string;
    domain: string;
    heroImageUrl?: string;
};

export type TokenInfo = {
    symbol: string;
    decimals: number;
};

export type TokenAmount = {
    amount: number;
    eurAmount: number;
    usdAmount: number;
    gbpAmount: number;
};

export type PurchaseInfo = {
    amount: number;
    currency: string;
};

export type RewardHistoryItem = {
    merchant: MerchantInfo;
    token: TokenInfo;
    amount: TokenAmount;
    status: AssetStatus;
    role: RecipientType;
    trigger: InteractionType;
    txHash?: string;
    createdAt: number;
    settledAt?: number;
    purchase?: PurchaseInfo;
};
