import type { RewardHistoryItem as BackendRewardHistoryItem } from "@frak-labs/backend-elysia/api/schemas";

export type {
    AssetStatus,
    InteractionType,
    RecipientType,
} from "@frak-labs/backend-elysia/domain/rewards/schemas";

export type RewardHistoryItem = Omit<
    BackendRewardHistoryItem,
    "createdAt" | "settledAt"
> & {
    createdAt: number;
    settledAt?: number;
};

export type MerchantInfo = RewardHistoryItem["merchant"];
export type TokenInfo = RewardHistoryItem["token"];
export type TokenAmount = RewardHistoryItem["amount"];
export type PurchaseInfo = NonNullable<RewardHistoryItem["purchase"]>;
