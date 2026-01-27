/**
 * Campaign status aligned with backend API
 * - draft: Campaign created but not yet published
 * - active: Campaign is running and distributing rewards
 * - paused: Campaign temporarily paused
 * - archived: Campaign archived and no longer active
 */
export type CampaignStatus = "draft" | "active" | "paused" | "archived";

/**
 * Campaign trigger types
 */
export type CampaignTrigger =
    | "purchase"
    | "signup"
    | "wallet_connect"
    | "custom";

/**
 * Condition operator for rule conditions
 */
export type ConditionOperator =
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "not_in"
    | "contains"
    | "starts_with"
    | "ends_with"
    | "exists"
    | "not_exists"
    | "between";

/**
 * Single rule condition
 */
export type RuleCondition = {
    field: string;
    operator: ConditionOperator;
    value: unknown;
    valueTo?: unknown;
};

/**
 * Recursive condition group for complex rule logic
 */
export type ConditionGroup = {
    logic: "all" | "any" | "none";
    conditions: Array<RuleCondition | ConditionGroup>;
};

/**
 * Rule conditions can be a flat array or nested groups
 */
export type RuleConditions = RuleCondition[] | ConditionGroup;

/**
 * Reward recipient type
 */
export type RewardRecipient = "referrer" | "referee" | "user";

/**
 * Reward chaining configuration
 */
export type RewardChaining = {
    userPercent: number;
    deperditionPerLevel: number;
    maxDepth?: number;
};

/**
 * Reward tier for tiered rewards
 */
export type RewardTier = {
    minValue: number;
    maxValue?: number;
    amount: number;
};

/**
 * Fixed reward definition
 */
export type FixedReward = {
    recipient: RewardRecipient;
    type: "token";
    amountType: "fixed";
    amount: number;
    token?: string;
    description?: string;
    chaining?: RewardChaining;
};

/**
 * Percentage reward definition
 */
export type PercentageReward = {
    recipient: RewardRecipient;
    type: "token";
    amountType: "percentage";
    percent: number;
    percentOf: "purchase_amount" | "purchase_subtotal";
    maxAmount?: number;
    minAmount?: number;
    token?: string;
    description?: string;
    chaining?: RewardChaining;
};

/**
 * Tiered reward definition
 */
export type TieredReward = {
    recipient: RewardRecipient;
    type: "token";
    amountType: "tiered";
    tierField: string;
    tiers: RewardTier[];
    token?: string;
    description?: string;
    chaining?: RewardChaining;
};

/**
 * Union of all reward types
 */
export type RewardDefinition = FixedReward | PercentageReward | TieredReward;

/**
 * Campaign rule definition
 */
export type CampaignRule = {
    trigger: CampaignTrigger;
    conditions: RuleConditions;
    rewards: RewardDefinition[];
    pendingRewardExpirationDays?: number;
};

/**
 * Budget configuration item
 */
export type BudgetConfigItem = {
    label: string;
    durationInSeconds: number | null;
    amount: number;
};

/**
 * Budget configuration (array of budget items)
 */
export type BudgetConfig = BudgetConfigItem[];

/**
 * Campaign goal
 */
export type CampaignGoal =
    | "awareness"
    | "traffic"
    | "registration"
    | "sales"
    | "retention";

/**
 * Special category for campaigns
 */
export type SpecialCategory = "credit" | "jobs" | "housing" | "social";

/**
 * Campaign metadata
 */
export type CampaignMetadata = {
    goal?: CampaignGoal;
    specialCategories?: SpecialCategory[];
    territories?: string[];
};

/**
 * Campaign actions available to the user
 */
export type CampaignActions = {
    canEdit: boolean;
    canDelete: boolean;
    canPublish: boolean;
    canPause: boolean;
    canResume: boolean;
    canArchive: boolean;
};

/**
 * Campaign type aligned with backend API response
 */
export type Campaign = {
    id: string;
    merchantId: string;
    name: string;
    status: CampaignStatus;
    priority: number;
    rule: CampaignRule;
    metadata: CampaignMetadata | null;
    budgetConfig: BudgetConfig | null;
    budgetUsed: Record<string, unknown> | null;
    expiresAt: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

/**
 * Campaign with available actions
 */
export type CampaignWithActions = Campaign & {
    actions: CampaignActions;
};
