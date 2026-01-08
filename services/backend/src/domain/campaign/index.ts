export {
    type CampaignRuleInsert,
    type CampaignRuleSelect,
    campaignRulesTable,
} from "./db/schema";

export { CampaignRuleRepository } from "./repositories/CampaignRuleRepository";
export { RewardCalculator } from "./services/RewardCalculator";
export { RuleConditionEvaluator } from "./services/RuleConditionEvaluator";
export { RuleEngineService } from "./services/RuleEngineService";

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
