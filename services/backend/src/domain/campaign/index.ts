export { CampaignContext } from "./context";
export {
    type CampaignRuleInsert,
    type CampaignRuleSelect,
    campaignRulesTable,
} from "./db/schema";
export { CampaignRuleRepository } from "./repositories/CampaignRuleRepository";
export type { CampaignStatus } from "./schemas";
export {
    BudgetConfigSchema,
    CampaignMetadataSchema,
    CampaignResponseSchema,
    CampaignRuleDefinitionSchema,
    CampaignStatusSchema,
    CampaignTriggerSchema,
    ConditionGroupSchema,
    ConditionOperatorSchema,
    RewardChainingSchema,
    RewardDefinitionSchema,
    RuleConditionSchema,
    RuleConditionsSchema,
} from "./schemas";
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
