export { CampaignContext } from "./context";
export {
    type CampaignRuleInsert,
    type CampaignRuleSelect,
    type CampaignStatus,
    CampaignStatuses,
    campaignRulesTable,
} from "./db/schema";
export { CampaignRuleRepository } from "./repositories/CampaignRuleRepository";
export { CampaignManagementService } from "./services/CampaignManagementService";
export { RewardCalculator } from "./services/RewardCalculator";
export { RuleConditionEvaluator } from "./services/RuleConditionEvaluator";
export {
    buildTimeContext,
    RuleEngineService,
} from "./services/RuleEngineService";

export type {
    BudgetConfig,
    BudgetConsumptionResult,
    BudgetUsed,
    CalculatedReward,
    CampaignMetadata,
    CampaignRuleDefinition,
    CampaignTrigger,
    ConditionGroup,
    ConditionOperator,
    EvaluationResult,
    FixedRewardDefinition,
    PercentageRewardDefinition,
    PurchaseContext,
    ReferralChainFetcher,
    ReferralChainMember,
    RewardChaining,
    RewardDefinition,
    RuleCondition,
    RuleContext,
    TieredRewardDefinition,
    TimeContext,
} from "./types";
