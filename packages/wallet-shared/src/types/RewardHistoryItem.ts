export type RewardStatus =
    | "pending"
    | "processing"
    | "settled"
    | "error"
    | "cancelled"
    | "timeout";

export type TriggerType =
    | "referral"
    | "purchase"
    | "wallet_connect"
    | "identity_merge";

export type RecipientType = "referral" | "referrer";

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
