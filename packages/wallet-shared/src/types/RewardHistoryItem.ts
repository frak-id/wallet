import type { RewardHistoryItem as BackendRewardHistoryItem } from "@frak-labs/backend-elysia/domain/rewards";

export type {
    AssetStatus,
    InteractionType,
    RecipientType,
} from "@frak-labs/backend-elysia/domain/rewards/schemas";

export type RewardHistoryItem = Omit<
    BackendRewardHistoryItem,
    "createdAt" | "settledAt" | "availableAt"
> & {
    createdAt: number;
    settledAt?: number;
    availableAt?: number;
};

export type MerchantInfo = RewardHistoryItem["merchant"];
export type TokenInfo = RewardHistoryItem["token"];
export type TokenAmount = RewardHistoryItem["amount"];
export type PurchaseInfo = NonNullable<RewardHistoryItem["purchase"]>;
