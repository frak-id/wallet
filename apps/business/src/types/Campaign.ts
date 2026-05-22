import type { CampaignResponse } from "@frak-labs/backend-elysia/domain/campaign";

export type {
    BudgetConfig,
    BudgetConfigItem,
    CampaignGoal,
    CampaignMetadata,
    CampaignResponse as Campaign,
    CampaignRuleDefinition,
    CampaignStatus,
    CampaignTrigger,
    ConditionGroup,
    FixedRewardDefinition,
    RewardDefinition,
    RuleCondition,
    RuleConditions,
    SpecialCategory,
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

export type { DistributionStatus } from "@frak-labs/backend-elysia/domain/campaign-bank";
