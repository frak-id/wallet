import type {
    CampaignListItem as ApiCampaignListItem,
    CampaignListResponse as ApiCampaignListResponse,
    CampaignListReward,
} from "@frak-labs/backend-elysia/api/schemas";
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
    RewardChaining,
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

export type CampaignListItem = ApiCampaignListItem;
export type CampaignListItemWithActions = ApiCampaignListItem & {
    actions: CampaignActions;
};
export type { CampaignListReward };
export type CampaignListResponse = Omit<
    ApiCampaignListResponse,
    "campaigns"
> & {
    campaigns: CampaignListItemWithActions[];
};

export type { DistributionStatus } from "@frak-labs/backend-elysia/domain/campaign-bank";
