import type { CampaignResponse } from "@frak-labs/backend-elysia/domain/campaign";

export type {
    BudgetConfig,
    BudgetConfigItem,
    BudgetUsed,
    CampaignGoal,
    CampaignMetadata,
    CampaignResponse,
    CampaignResponse as Campaign,
    CampaignRuleDefinition,
    CampaignStatus,
    CampaignTrigger,
    ConditionGroup,
    ConditionOperator,
    FixedRewardDefinition,
    PercentageRewardDefinition,
    RewardChaining,
    RewardDefinition,
    RewardRecipient,
    RuleCondition,
    RuleConditions,
    SpecialCategory,
    TieredRewardDefinition,
} from "@frak-labs/backend-elysia/domain/campaign";

export type CampaignActions = {
    canEdit: boolean;
    canDelete: boolean;
    canPublish: boolean;
    canPause: boolean;
    canResume: boolean;
    canArchive: boolean;
};

export type CampaignWithActions = {
    actions: CampaignActions;
} & CampaignResponse;
