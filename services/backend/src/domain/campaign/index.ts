export {
    campaignRulesTable,
    type CampaignRuleInsert,
    type CampaignRuleSelect,
} from "./db/schema";

export { CampaignRuleRepository } from "./repositories/CampaignRuleRepository";

export { RuleConditionEvaluator } from "./services/RuleConditionEvaluator";
export { RewardCalculator } from "./services/RewardCalculator";
export { RuleEngineService } from "./services/RuleEngineService";

export type {
    CampaignTrigger,
    ConditionOperator,
    RuleCondition,
    ConditionGroup,
    RewardRecipient,
    RewardAssetType,
    FixedRewardDefinition,
    PercentageRewardDefinition,
    TieredRewardDefinition,
    RangeRewardDefinition,
    RewardDefinition,
    CampaignRuleDefinition,
    CampaignGoal,
    SpecialCategory,
    CampaignMetadata,
    BudgetConfigItem,
    BudgetConfig,
    BudgetUsedItem,
    BudgetUsed,
    PurchaseItem,
    PurchaseContext,
    AttributionContext,
    UserRewardHistory,
    UserContext,
    TimeContext,
    RuleContext,
    CalculatedReward,
    EvaluationResult,
    BudgetConsumptionResult,
} from "./types";
