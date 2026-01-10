export { CampaignContext } from "./context";
export {
    type CampaignRuleInsert,
    type CampaignRuleSelect,
    type CampaignStatus,
    campaignRulesTable,
    campaignStatusEnum,
} from "./db/schema";
export { CampaignRuleRepository } from "./repositories/CampaignRuleRepository";
export {
    type CampaignCreateInput,
    CampaignManagementService,
    type CampaignResult,
    type CampaignUpdateInput,
} from "./services/CampaignManagementService";
export { RewardCalculator } from "./services/RewardCalculator";
export { RuleConditionEvaluator } from "./services/RuleConditionEvaluator";
export {
    buildTimeContext,
    RuleEngineService,
} from "./services/RuleEngineService";

export type {
    AttributionContext,
    BudgetConfig,
    BudgetConfigItem,
    BudgetConsumptionResult,
    BudgetUsed,
    BudgetUsedItem,
    CalculatedReward,
    CampaignGoal,
    CampaignMetadata,
    CampaignRuleDefinition,
    CampaignTrigger,
    ConditionGroup,
    ConditionOperator,
    EvaluationResult,
    FixedRewardDefinition,
    PercentageRewardDefinition,
    PurchaseContext,
    PurchaseItem,
    RangeRewardDefinition,
    ReferralChainFetcher,
    ReferralChainMember,
    RewardAssetType,
    RewardChaining,
    RewardDefinition,
    RewardRecipient,
    RuleCondition,
    RuleContext,
    SpecialCategory,
    TieredRewardDefinition,
    TimeContext,
    UserContext,
    UserRewardHistory,
} from "./types";
