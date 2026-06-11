import type { Address } from "viem";
import type { AssetType, RecipientType } from "../../rewards/schemas";

export type {
    BudgetConfig,
    CampaignMetadata,
    CampaignRuleDefinition,
    CampaignTrigger,
    ConditionGroup,
    ConditionOperator,
    FixedRewardDefinition,
    PercentageRewardDefinition,
    RewardChaining,
    RewardDefinition,
    RuleCondition,
    TieredRewardDefinition,
} from "../schemas";

type BudgetUsedItem = {
    resetAt?: string;
    used: number;
};

export type BudgetUsed = Record<string, BudgetUsedItem>;

type PurchaseItem = {
    productId?: string;
    name?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: string;
    sku?: string;
};

export type PurchaseContext = {
    orderId: string;
    /**
     * Order total in `currency` units — raw fiat, never FX-normalized. Rule
     * conditions and tier thresholds compare it as-is, so they are
     * order-currency-relative: "min 500" means 500 JPY on a JPY order, not
     * 500 EUR. Only percentage reward amounts go through FX conversion.
     * TODO(follow-up): normalize once when building the context, or scope
     * thresholds per currency.
     */
    amount: number;
    currency: string;
    items: PurchaseItem[];
    isFirstPurchase?: boolean;
    discountCodes?: string[];
    shippingCost?: number;
    taxAmount?: number;
};

type AttributionContext = {
    referrerIdentityGroupId: string | null;
};

type UserRewardHistory = {
    campaignRewardCount?: number;
    campaignRewardAmount?: number;
    merchantRewardCount?: number;
    merchantRewardAmount?: number;
};

type UserContext = {
    identityGroupId: string;
    walletAddress: Address | null;
    countryCode?: string;
    isNew?: boolean;
    totalPurchases?: number;
    totalSpend?: number;
    rewards?: UserRewardHistory;
};

export type TimeContext = {
    dayOfWeek: number;
    hourOfDay: number;
    date: string;
    timestamp: number;
};

export type CustomInteractionContext = {
    customType: string;
    data: Record<string, unknown>;
};

export type RuleContext = {
    purchase?: PurchaseContext;
    attribution?: AttributionContext;
    user: UserContext;
    time: TimeContext;
    custom?: CustomInteractionContext;
};

export type CalculatedReward = {
    recipient: RecipientType;
    recipientIdentityGroupId: string;
    type: AssetType;
    amount: number;
    token: Address | null;
    campaignRuleId: string;
    description?: string;
    chainDepth?: number;
    expirationDays?: number;
    /** Seconds the reward stays locked before settlement. 0/undefined = no lockup. */
    lockupSeconds?: number;
};

export type EvaluationResult = {
    rewards: CalculatedReward[];
    budgetExceeded: boolean;
    skippedCampaigns: string[];
    errors: {
        campaignRuleId: string;
        error: string;
    }[];
    /**
     * True when a matched percentage reward could not be converted into its
     * token amount (no FX rate for the purchase currency or token price
     * unavailable). The orchestrator leaves the interaction unprocessed so
     * the next cron run retries it — failure is logged only, nothing is
     * persisted. TODO: if production logs ever show a row stuck on this path
     * (starving the batch), add an attempt counter + backoff on
     * interaction_logs.
     */
    deferForUnpriceableReward: boolean;
    /** Why pricing failed — logged by the orchestrator, not persisted. */
    deferReason?: string;
};

export type BudgetConsumptionResult = {
    success: boolean;
    remaining?: Record<string, number>;
    exceededBudget?: string;
    reason?: "budget_exceeded" | "campaign_not_found";
};

export type ReferralChainMember = {
    identityGroupId: string;
    depth: number;
};

export type ReferralChainFetcher = (params: {
    merchantId: string;
    identityGroupId: string;
    maxDepth: number;
}) => Promise<ReferralChainMember[]>;
