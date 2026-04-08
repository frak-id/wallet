import { t } from "@backend-utils";
import type { Static, TSchema } from "elysia";
import { DistributionStatusSchema } from "../../campaign-bank/schemas";
import {
    AssetTypeSchema,
    type InteractionType,
    InteractionTypeSchema,
    RecipientTypeSchema,
} from "../../rewards/schemas";

export const CampaignStatusSchema = t.Union([
    t.Literal("draft"),
    t.Literal("active"),
    t.Literal("paused"),
    t.Literal("archived"),
]);
export type CampaignStatus = Static<typeof CampaignStatusSchema>;

export const CampaignTriggerSchema = InteractionTypeSchema;
export type CampaignTrigger = InteractionType;

export const ConditionOperatorSchema = t.Union([
    t.Literal("eq"),
    t.Literal("neq"),
    t.Literal("gt"),
    t.Literal("gte"),
    t.Literal("lt"),
    t.Literal("lte"),
    t.Literal("in"),
    t.Literal("not_in"),
    t.Literal("contains"),
    t.Literal("starts_with"),
    t.Literal("ends_with"),
    t.Literal("exists"),
    t.Literal("not_exists"),
    t.Literal("between"),
]);
export type ConditionOperator = Static<typeof ConditionOperatorSchema>;

const RuleConditionValue = t.Union([
    t.String(),
    t.Number(),
    t.Boolean(),
    t.Null(),
]);

export const RuleConditionSchema = t.Object({
    field: t.String(),
    operator: ConditionOperatorSchema,
    value: RuleConditionValue,
    valueTo: t.Optional(RuleConditionValue),
});
export type RuleCondition = Static<typeof RuleConditionSchema>;

// Recursive schema - t.Recursive required for self-referential ConditionGroup
export const ConditionGroupSchema: TSchema = t.Recursive(
    (Self) =>
        t.Object({
            logic: t.Union([
                t.Literal("all"),
                t.Literal("any"),
                t.Literal("none"),
            ]),
            conditions: t.Array(t.Union([RuleConditionSchema, Self])),
        }),
    { $id: "ConditionGroup" }
);

export type ConditionGroup = {
    logic: "all" | "any" | "none";
    conditions: Array<RuleCondition | ConditionGroup>;
};

export const RuleConditionsSchema = t.Union([
    t.Array(RuleConditionSchema),
    ConditionGroupSchema,
]);
export type RuleConditions = RuleCondition[] | ConditionGroup;

export const RewardChainingSchema = t.Object({
    deperditionPerLevel: t.Number(),
    maxDepth: t.Optional(t.Number()),
});
export type RewardChaining = Static<typeof RewardChainingSchema>;

const RewardTierSchema = t.Object({
    minValue: t.Number(),
    maxValue: t.Optional(t.Number()),
    amount: t.Number(),
});

const FixedRewardDefinitionSchema = t.Object({
    recipient: RecipientTypeSchema,
    type: AssetTypeSchema,
    amountType: t.Literal("fixed"),
    amount: t.Number(),
    token: t.Optional(t.Hex()),
    description: t.Optional(t.String()),
    chaining: t.Optional(RewardChainingSchema),
});
export type FixedRewardDefinition = Static<typeof FixedRewardDefinitionSchema>;

const PercentageRewardDefinitionSchema = t.Object({
    recipient: RecipientTypeSchema,
    type: AssetTypeSchema,
    amountType: t.Literal("percentage"),
    percent: t.Number(),
    percentOf: t.Union([
        t.Literal("purchase_amount"),
        t.Literal("purchase_subtotal"),
    ]),
    maxAmount: t.Optional(t.Number()),
    minAmount: t.Optional(t.Number()),
    token: t.Optional(t.Hex()),
    description: t.Optional(t.String()),
    chaining: t.Optional(RewardChainingSchema),
});
export type PercentageRewardDefinition = Static<
    typeof PercentageRewardDefinitionSchema
>;

const TieredRewardDefinitionSchema = t.Object({
    recipient: RecipientTypeSchema,
    type: AssetTypeSchema,
    amountType: t.Literal("tiered"),
    tierField: t.String(),
    tiers: t.Array(RewardTierSchema),
    token: t.Optional(t.Hex()),
    description: t.Optional(t.String()),
    chaining: t.Optional(RewardChainingSchema),
});
export type TieredRewardDefinition = Static<
    typeof TieredRewardDefinitionSchema
>;

export const RewardDefinitionSchema = t.Union([
    FixedRewardDefinitionSchema,
    PercentageRewardDefinitionSchema,
    TieredRewardDefinitionSchema,
]);
export type RewardDefinition = Static<typeof RewardDefinitionSchema>;

export const CampaignRuleDefinitionSchema = t.Object({
    trigger: CampaignTriggerSchema,
    conditions: RuleConditionsSchema,
    rewards: t.Array(RewardDefinitionSchema),
    pendingRewardExpirationDays: t.Optional(t.Number()),
    maxRewardsPerUser: t.Optional(t.Number()),
    merchantMaxRewardsPerUser: t.Optional(t.Number()),
});
// Manual type def needed - recursive ConditionGroupSchema breaks Static<> inference
export type CampaignRuleDefinition = {
    trigger: CampaignTrigger;
    conditions: RuleConditions;
    rewards: RewardDefinition[];
    pendingRewardExpirationDays?: number;
    maxRewardsPerUser?: number;
    merchantMaxRewardsPerUser?: number;
};

const BudgetConfigItemSchema = t.Object({
    label: t.String(),
    durationInSeconds: t.Union([t.Number(), t.Null()]),
    amount: t.Number(),
});
export type BudgetConfigItem = Static<typeof BudgetConfigItemSchema>;

const BudgetUsedItemSchema = t.Object({
    resetAt: t.Optional(t.String()),
    used: t.Number(),
});

const BudgetUsedSchema = t.Record(t.String(), BudgetUsedItemSchema);
export type BudgetUsed = Static<typeof BudgetUsedSchema>;

export const BudgetConfigSchema = t.Array(BudgetConfigItemSchema);
export type BudgetConfig = Static<typeof BudgetConfigSchema>;

const CampaignGoalSchema = t.Union([
    t.Literal("awareness"),
    t.Literal("traffic"),
    t.Literal("registration"),
    t.Literal("sales"),
    t.Literal("retention"),
]);
export type CampaignGoal = Static<typeof CampaignGoalSchema>;

const SpecialCategorySchema = t.Union([
    t.Literal("credit"),
    t.Literal("jobs"),
    t.Literal("housing"),
    t.Literal("social"),
]);
export type SpecialCategory = Static<typeof SpecialCategorySchema>;

export const CampaignMetadataSchema = t.Object({
    goal: t.Optional(CampaignGoalSchema),
    specialCategories: t.Optional(t.Array(SpecialCategorySchema)),
    territories: t.Optional(t.Array(t.String())),
});
export type CampaignMetadata = Static<typeof CampaignMetadataSchema>;

const EstimatedRewardTierSchema = t.Object({
    minValue: t.Number(),
    maxValue: t.Optional(t.Number()),
    amount: t.TokenAmount,
});

const FixedEstimatedRewardSchema = t.Object({
    payoutType: t.Literal("fixed"),
    amount: t.TokenAmount,
});

const PercentageEstimatedRewardSchema = t.Object({
    payoutType: t.Literal("percentage"),
    percent: t.Number(),
    percentOf: t.String(),
    maxAmount: t.Optional(t.TokenAmount),
    minAmount: t.Optional(t.TokenAmount),
});

const TieredEstimatedRewardSchema = t.Object({
    payoutType: t.Literal("tiered"),
    tierField: t.String(),
    tiers: t.Array(EstimatedRewardTierSchema),
});

const EstimatedRewardSchema = t.Union([
    FixedEstimatedRewardSchema,
    PercentageEstimatedRewardSchema,
    TieredEstimatedRewardSchema,
]);
export type EstimatedReward = Static<typeof EstimatedRewardSchema>;

const EstimatedRewardItemSchema = t.Object({
    token: t.Optional(t.Address()),
    campaignId: t.String(),
    name: t.String(),
    interactionTypeKey: t.String(),
    referrer: t.Optional(EstimatedRewardSchema),
    referee: t.Optional(EstimatedRewardSchema),
    conditions: RuleConditionsSchema,
    pendingRewardExpirationDays: t.Optional(t.Number()),
    maxRewardsPerUser: t.Optional(t.Number()),
    merchantMaxRewardsPerUser: t.Optional(t.Number()),
});
export type EstimatedRewardItem = Omit<
    Static<typeof EstimatedRewardItemSchema>,
    "conditions"
> & { conditions: RuleConditions };

export const EstimatedRewardsResultSchema = t.Object({
    rewards: t.Array(EstimatedRewardItemSchema),
});
export type EstimatedRewardsResult = Static<
    typeof EstimatedRewardsResultSchema
>;

export const CampaignResponseSchema = t.Object({
    id: t.String(),
    merchantId: t.String(),
    name: t.String(),
    status: CampaignStatusSchema,
    priority: t.Number(),
    rule: CampaignRuleDefinitionSchema,
    metadata: t.Union([CampaignMetadataSchema, t.Null()]),
    budgetConfig: t.Union([BudgetConfigSchema, t.Null()]),
    budgetUsed: t.Union([BudgetUsedSchema, t.Null()]),
    bankDistributionStatus: t.Union([DistributionStatusSchema, t.Null()]),
    expiresAt: t.Union([t.String(), t.Null()]),
    publishedAt: t.Union([t.String(), t.Null()]),
    createdAt: t.String(),
    updatedAt: t.String(),
});
export type CampaignResponse = Omit<
    Static<typeof CampaignResponseSchema>,
    "rule"
> & { rule: CampaignRuleDefinition };
