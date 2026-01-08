import type { Address } from "viem";

// =============================================================================
// CAMPAIGN TRIGGERS
// =============================================================================

/**
 * Events that can trigger campaign rule evaluation.
 */
export type CampaignTrigger =
    | "purchase" // Any purchase event
    | "referral_purchase" // Purchase with referral attribution
    | "signup" // User registration
    | "wallet_connect" // Wallet connection
    | "custom"; // Custom trigger for future extensibility

// =============================================================================
// RULE CONDITIONS
// =============================================================================

/**
 * Comparison operators for rule conditions.
 */
export type ConditionOperator =
    | "eq" // Equal
    | "neq" // Not equal
    | "gt" // Greater than
    | "gte" // Greater than or equal
    | "lt" // Less than
    | "lte" // Less than or equal
    | "in" // Value in array
    | "not_in" // Value not in array
    | "contains" // String contains
    | "starts_with" // String starts with
    | "ends_with" // String ends with
    | "exists" // Field exists and is not null
    | "not_exists" // Field does not exist or is null
    | "between"; // Value between two values (inclusive)

/**
 * A single condition to evaluate against the context.
 * Uses dot notation for nested fields (e.g., "purchase.amount", "attribution.source")
 */
export type RuleCondition = {
    field: string;
    operator: ConditionOperator;
    value: unknown;
    /**
     * For "between" operator: [min, max] inclusive
     */
    valueTo?: unknown;
};

/**
 * Logical grouping of conditions.
 * - "all": All conditions must match (AND)
 * - "any": At least one condition must match (OR)
 * - "none": No conditions should match (NOR)
 */
export type ConditionGroup = {
    logic: "all" | "any" | "none";
    conditions: Array<RuleCondition | ConditionGroup>;
};

// =============================================================================
// REWARD DEFINITIONS
// =============================================================================

/**
 * Who receives the reward.
 */
export type RewardRecipient =
    | "referrer" // The user who shared the referral link
    | "referee" // The user who clicked the referral link and converted
    | "user"; // The current user (for any non-referral rewards)

/**
 * Type of reward asset.
 */
export type RewardAssetType =
    | "token" // Crypto token (USDC, etc.)
    | "discount" // Store discount (soft reward)
    | "points"; // Loyalty points (soft reward)

export type RewardChaining = {
    userPercent: number;
    deperditionPerLevel: number;
    maxDepth?: number;
};

type BaseRewardDefinition = {
    recipient: RewardRecipient;
    type: RewardAssetType;
    description?: string;
    chaining?: RewardChaining;
};

/**
 * Fixed amount reward.
 * Example: "Give 10 USDC to referrer"
 */
export type FixedRewardDefinition = BaseRewardDefinition & {
    amountType: "fixed";
    amount: number;
    /**
     * Token address for crypto rewards. If not specified, uses merchant's default token.
     */
    token?: Address;
};

/**
 * Percentage-based reward.
 * Example: "Give 5% of purchase amount to referee"
 */
export type PercentageRewardDefinition = BaseRewardDefinition & {
    amountType: "percentage";
    /**
     * Percentage value (e.g., 5 for 5%)
     */
    percent: number;
    /**
     * What the percentage is calculated from.
     */
    percentOf: "purchase_amount" | "purchase_subtotal" | "purchase_profit";
    /**
     * Maximum amount cap (optional)
     */
    maxAmount?: number;
    /**
     * Minimum amount floor (optional)
     */
    minAmount?: number;
    /**
     * Token address for crypto rewards.
     */
    token?: Address;
};

/**
 * Tiered reward - different amounts based on thresholds.
 * Example: "Give 5 USDC for purchases under $50, 10 USDC for $50-100, 20 USDC for $100+"
 */
export type TieredRewardDefinition = BaseRewardDefinition & {
    amountType: "tiered";
    /**
     * The field to evaluate for tier selection (e.g., "purchase.amount")
     */
    tierField: string;
    /**
     * Tiers sorted by minValue ascending.
     * The first matching tier (where value >= minValue) is used.
     */
    tiers: Array<{
        minValue: number;
        maxValue?: number;
        amount: number;
    }>;
    /**
     * Token address for crypto rewards.
     */
    token?: Address;
};

/**
 * Range-based reward using beta distribution.
 * The base amount is multiplied by a random factor between minMultiplier and maxMultiplier.
 */
export type RangeRewardDefinition = BaseRewardDefinition & {
    amountType: "range";
    baseAmount: number;
    minMultiplier: number;
    maxMultiplier: number;
    token?: Address;
};

export type RewardDefinition =
    | FixedRewardDefinition
    | PercentageRewardDefinition
    | TieredRewardDefinition
    | RangeRewardDefinition;

// =============================================================================
// CAMPAIGN RULE
// =============================================================================

/**
 * The complete rule definition stored in the campaign_rules table.
 */
export type CampaignRuleDefinition = {
    /**
     * Which event triggers this rule.
     */
    trigger: CampaignTrigger;
    /**
     * Conditions that must be met for the rule to apply.
     * Can be a simple array (AND logic) or a complex condition group.
     */
    conditions: RuleCondition[] | ConditionGroup;
    /**
     * Rewards to issue when the rule matches.
     */
    rewards: RewardDefinition[];
};

// =============================================================================
// METADATA
// =============================================================================

export type CampaignGoal =
    | "awareness"
    | "traffic"
    | "registration"
    | "sales"
    | "retention";

export type SpecialCategory = "credit" | "jobs" | "housing" | "social";

export type CampaignMetadata = {
    goal?: CampaignGoal;
    specialCategories?: SpecialCategory[];
    territories?: string[];
};

// =============================================================================
// BUDGET
// =============================================================================

export type BudgetConfigItem = {
    label: string;
    durationInSeconds: number | null;
    amount: number;
};

export type BudgetConfig = BudgetConfigItem[];

export type BudgetUsedItem = {
    resetAt?: string;
    used: number;
};

export type BudgetUsed = Record<string, BudgetUsedItem>;

// =============================================================================
// EVALUATION CONTEXT
// =============================================================================

/**
 * Purchase item in the context.
 */
export type PurchaseItem = {
    productId?: string;
    name?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: string;
    sku?: string;
};

/**
 * Purchase data in the context.
 */
export type PurchaseContext = {
    orderId: string;
    amount: number;
    subtotal?: number;
    currency: string;
    items: PurchaseItem[];
    /**
     * Whether this is the user's first purchase with this merchant.
     */
    isFirstPurchase?: boolean;
    /**
     * Discount codes applied.
     */
    discountCodes?: string[];
    /**
     * Shipping cost if applicable.
     */
    shippingCost?: number;
    /**
     * Tax amount if applicable.
     */
    taxAmount?: number;
};

/**
 * Attribution data in the context.
 */
export type AttributionContext = {
    source: "referral_link" | "organic" | "paid_ad" | "direct" | null;
    touchpointId: string | null;
    referrerWallet: Address | null;
    /**
     * UTM parameters if available.
     */
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
};

export type UserRewardHistory = {
    campaignRewardCount?: number;
    campaignRewardAmount?: number;
    merchantRewardCount?: number;
    merchantRewardAmount?: number;
};

export type UserContext = {
    identityGroupId: string;
    walletAddress: Address | null;
    countryCode?: string;
    isNew?: boolean;
    totalPurchases?: number;
    totalSpend?: number;
    rewards?: UserRewardHistory;
};

/**
 * Time-based context for time-sensitive rules.
 */
export type TimeContext = {
    /**
     * Day of week (0 = Sunday, 6 = Saturday)
     */
    dayOfWeek: number;
    /**
     * Hour of day (0-23)
     */
    hourOfDay: number;
    /**
     * ISO date string (YYYY-MM-DD)
     */
    date: string;
    /**
     * Unix timestamp in seconds
     */
    timestamp: number;
};

/**
 * The complete context passed to the rule engine for evaluation.
 */
export type RuleContext = {
    purchase?: PurchaseContext;
    attribution?: AttributionContext;
    user: UserContext;
    time: TimeContext;
    /**
     * Custom fields for extensibility.
     */
    custom?: Record<string, unknown>;
};

// =============================================================================
// EVALUATION RESULTS
// =============================================================================

/**
 * A calculated reward ready for processing.
 */
export type CalculatedReward = {
    recipient: RewardRecipient;
    recipientIdentityGroupId: string;
    recipientWallet: Address | null;
    type: RewardAssetType;
    amount: number;
    token: Address | null;
    campaignRuleId: string;
    description?: string;
    chainDepth?: number;
};

/**
 * Result of evaluating campaign rules.
 */
export type EvaluationResult = {
    /**
     * Rewards that were successfully calculated and have available budget.
     */
    rewards: CalculatedReward[];
    /**
     * True if any reward was skipped due to budget constraints.
     */
    budgetExceeded: boolean;
    /**
     * Campaign rule IDs that hit their budget limit.
     */
    skippedCampaigns: string[];
    /**
     * Campaign rules that matched but rewards couldn't be calculated.
     */
    errors: Array<{
        campaignRuleId: string;
        error: string;
    }>;
};

export type BudgetConsumptionResult = {
    success: boolean;
    remaining?: Record<string, number>;
    exceededBudget?: string;
    reason?: "budget_exceeded" | "campaign_not_found";
};
