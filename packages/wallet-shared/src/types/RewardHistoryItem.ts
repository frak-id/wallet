import type {
    AssetStatus,
    InteractionType,
    RecipientType,
} from "@frak-labs/backend-elysia/domain/rewards/schemas";

export type RewardStatus = AssetStatus;
export type TriggerType = InteractionType;
export type { RecipientType };

export type MerchantInfo = {
    name: string;
    domain: string;
};

export type TokenInfo = {
    address: string;
    symbol: string;
    decimals: number;
    logo?: string;
};

export type RewardHistoryItem = {
    id: string;
    amount: number;
    timestamp: number;
    txHash?: string;
    status: RewardStatus;
    trigger: TriggerType | null;
    recipientType: RecipientType;
    merchant: MerchantInfo;
    token: TokenInfo;
};
