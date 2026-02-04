export type RewardStatus =
    | "pending"
    | "processing"
    | "settled"
    | "consumed"
    | "cancelled"
    | "expired";

export type TriggerType =
    | "referral"
    | "create_referral_link"
    | "purchase"
    | "custom";

export type RecipientType = "referee" | "referrer";

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
