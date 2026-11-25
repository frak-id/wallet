import type { RewardHistoryItem as BackendRewardHistoryItem } from "@frak-labs/backend-elysia/domain/rewards";
import type {
    PlanStep as BackendPlanStep,
    RewardPlan as BackendRewardPlan,
} from "@frak-labs/backend-elysia/domain/rewards/schemas";

export type {
    AssetStatus,
    InteractionType,
    RecipientType,
} from "@frak-labs/backend-elysia/domain/rewards/schemas";

export type RewardPlanStep = Omit<
    BackendPlanStep,
    "availableAt" | "settledAt"
> & {
    availableAt?: number;
    settledAt?: number;
};

export type RewardPlan = Omit<BackendRewardPlan, "steps"> & {
    steps: RewardPlanStep[];
};

export type RewardHistoryItem = Omit<
    BackendRewardHistoryItem,
    "createdAt" | "settledAt" | "availableAt" | "plan"
> & {
    createdAt: number;
    settledAt?: number;
    availableAt?: number;
    plan?: RewardPlan;
};

export type MerchantInfo = RewardHistoryItem["merchant"];
export type TokenInfo = RewardHistoryItem["token"];
export type TokenAmount = RewardHistoryItem["amount"];
export type PurchaseInfo = NonNullable<RewardHistoryItem["purchase"]>;
