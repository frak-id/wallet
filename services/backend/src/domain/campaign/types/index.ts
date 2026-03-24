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
    amount: number;
    subtotal?: number;
    currency: string;
    items: PurchaseItem[];
    isFirstPurchase?: boolean;
    discountCodes?: string[];
    shippingCost?: number;
    taxAmount?: number;
};

type AttributionContext = {
    source: "referral_link" | "organic" | "paid_ad" | "direct" | null;
    touchpointId: string | null;
    referrerIdentityGroupId: string | null;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
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
};

export type EvaluationResult = {
    rewards: CalculatedReward[];
    budgetExceeded: boolean;
    skippedCampaigns: string[];
    errors: {
        campaignRuleId: string;
        error: string;
    }[];
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
