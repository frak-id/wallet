import { t } from "@backend-utils";
import type { Static } from "elysia";
import {
    BudgetConfigSchema,
    type BudgetUsed,
    CampaignMetadataSchema,
    CampaignRuleDefinitionSchema,
    CampaignStatusSchema,
} from "../../domain/campaign/schemas";
import { DistributionStatusSchema } from "../../domain/campaign-bank/schemas";
import { RecipientTypeSchema } from "../../domain/rewards/schemas";
import { CampaignStatsItemSchema } from "../../orchestration/schemas/campaignStatsSchemas";

export const CampaignCreateBodySchema = t.Object({
    name: t.String(),
    rule: CampaignRuleDefinitionSchema,
    metadata: t.Optional(CampaignMetadataSchema),
    budgetConfig: t.Optional(BudgetConfigSchema),
    expiresAt: t.Optional(t.String()),
    priority: t.Optional(t.Number()),
});
export type CampaignCreateBody = Static<typeof CampaignCreateBodySchema>;

export const CampaignUpdateBodySchema = t.Object({
    name: t.Optional(t.String()),
    rule: t.Optional(CampaignRuleDefinitionSchema),
    metadata: t.Optional(CampaignMetadataSchema),
    budgetConfig: t.Optional(BudgetConfigSchema),
    expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
    priority: t.Optional(t.Number()),
});
export type CampaignUpdateBody = Static<typeof CampaignUpdateBodySchema>;

// Slim reward shape used by the list endpoint — just enough to render
// the "rewards summary" column without shipping the full RewardDefinition.
const CampaignListRewardSchema = t.Union([
    t.Object({
        recipient: RecipientTypeSchema,
        amountType: t.Literal("fixed"),
        amount: t.Number(),
    }),
    t.Object({
        recipient: RecipientTypeSchema,
        amountType: t.Literal("percentage"),
        percent: t.Number(),
    }),
    t.Object({
        recipient: RecipientTypeSchema,
        amountType: t.Literal("tiered"),
    }),
]);
export type CampaignListReward = Static<typeof CampaignListRewardSchema>;

// Per-row campaign payload returned by GET /:merchantId/campaigns.
// Trimmed compared to CampaignResponseSchema (no rule/metadata/priority/
// merchantId/updatedAt) and folds in the matching stats and a slim
// rewards summary so callers don't need a second roundtrip.
export const CampaignListItemSchema = t.Object({
    id: t.String(),
    name: t.String(),
    status: CampaignStatusSchema,
    rewards: t.Array(CampaignListRewardSchema),
    budgetConfig: t.Union([BudgetConfigSchema, t.Null()]),
    budgetUsed: t.Union([
        t.Record(
            t.String(),
            t.Object({
                resetAt: t.Optional(t.String()),
                used: t.Number(),
            })
        ),
        t.Null(),
    ]),
    expiresAt: t.Union([t.String(), t.Null()]),
    publishedAt: t.Union([t.String(), t.Null()]),
    createdAt: t.String(),
    stats: t.Union([CampaignStatsItemSchema, t.Null()]),
});
export type CampaignListItem = Omit<
    Static<typeof CampaignListItemSchema>,
    "budgetUsed"
> & { budgetUsed: BudgetUsed | null };

export const CampaignListResponseSchema = t.Object({
    bankDistributionStatus: t.Union([DistributionStatusSchema, t.Null()]),
    campaigns: t.Array(CampaignListItemSchema),
});
export type CampaignListResponse = Omit<
    Static<typeof CampaignListResponseSchema>,
    "campaigns"
> & { campaigns: CampaignListItem[] };
