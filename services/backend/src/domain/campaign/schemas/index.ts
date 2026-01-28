import { t } from "@backend-utils";
import type { Static, TSchema } from "elysia";

export const CampaignStatusSchema = t.Union([
    t.Literal("draft"),
    t.Literal("active"),
    t.Literal("paused"),
    t.Literal("archived"),
]);
export type CampaignStatus = Static<typeof CampaignStatusSchema>;

export const CampaignTriggerSchema = t.Union([
    t.Literal("purchase"),
    t.Literal("signup"),
    t.Literal("wallet_connect"),
    t.Literal("custom"),
]);
export type CampaignTrigger = Static<typeof CampaignTriggerSchema>;

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

export const RuleConditionValue = t.Union([
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

export const RewardRecipientSchema = t.Union([
    t.Literal("referrer"),
    t.Literal("referee"),
]);
export type RewardRecipient = Static<typeof RewardRecipientSchema>;

export const RewardAssetTypeSchema = t.Literal("token");
export type RewardAssetType = Static<typeof RewardAssetTypeSchema>;

export const RewardChainingSchema = t.Object({
    deperditionPerLevel: t.Number(),
    maxDepth: t.Optional(t.Number()),
});
export type RewardChaining = Static<typeof RewardChainingSchema>;

export const RewardTierSchema = t.Object({
    minValue: t.Number(),
    maxValue: t.Optional(t.Number()),
    amount: t.Number(),
});
export type RewardTier = Static<typeof RewardTierSchema>;

export const FixedRewardDefinitionSchema = t.Object({
    recipient: RewardRecipientSchema,
    type: RewardAssetTypeSchema,
    amountType: t.Literal("fixed"),
    amount: t.Number(),
    token: t.Optional(t.Hex()),
    description: t.Optional(t.String()),
    chaining: t.Optional(RewardChainingSchema),
});
export type FixedRewardDefinition = Static<typeof FixedRewardDefinitionSchema>;

export const PercentageRewardDefinitionSchema = t.Object({
    recipient: RewardRecipientSchema,
    type: RewardAssetTypeSchema,
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

export const TieredRewardDefinitionSchema = t.Object({
    recipient: RewardRecipientSchema,
    type: RewardAssetTypeSchema,
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
});
// Manual type def needed - recursive ConditionGroupSchema breaks Static<> inference
export type CampaignRuleDefinition = {
    trigger: CampaignTrigger;
    conditions: RuleConditions;
    rewards: RewardDefinition[];
    pendingRewardExpirationDays?: number;
};

export const BudgetConfigItemSchema = t.Object({
    label: t.String(),
    durationInSeconds: t.Union([t.Number(), t.Null()]),
    amount: t.Number(),
});
export type BudgetConfigItem = Static<typeof BudgetConfigItemSchema>;

export const BudgetUsedItemSchema = t.Object({
    resetAt: t.Optional(t.String()),
    used: t.Number(),
});
export type BudgetUsedItem = Static<typeof BudgetUsedItemSchema>;

export const BudgetUsedSchema = t.Record(t.String(), BudgetUsedItemSchema);
export type BudgetUsed = Static<typeof BudgetUsedSchema>;

export const BudgetConfigSchema = t.Array(BudgetConfigItemSchema);
export type BudgetConfig = Static<typeof BudgetConfigSchema>;

export const CampaignGoalSchema = t.Union([
    t.Literal("awareness"),
    t.Literal("traffic"),
    t.Literal("registration"),
    t.Literal("sales"),
    t.Literal("retention"),
]);
export type CampaignGoal = Static<typeof CampaignGoalSchema>;

export const SpecialCategorySchema = t.Union([
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
    expiresAt: t.Union([t.String(), t.Null()]),
    publishedAt: t.Union([t.String(), t.Null()]),
    createdAt: t.String(),
    updatedAt: t.String(),
});
export type CampaignResponse = Omit<
    Static<typeof CampaignResponseSchema>,
    "rule"
> & { rule: CampaignRuleDefinition };
