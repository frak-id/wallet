export { CampaignContext } from "./context";
export {
    type CampaignRuleInsert,
    type CampaignRuleSelect,
    campaignRulesTable,
} from "./db/schema";
export { CampaignRuleRepository } from "./repositories/CampaignRuleRepository";
export type {
    BudgetConfigItem,
    CampaignGoal,
    CampaignResponse,
    CampaignStatus,
    RuleConditions,
    SpecialCategory,
} from "./schemas";
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
    BudgetUsed,
    CalculatedReward,
    CampaignMetadata,
    CampaignRuleDefinition,
    CampaignTrigger,
    ConditionGroup,
    ConditionOperator,
    CustomInteractionContext,
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
