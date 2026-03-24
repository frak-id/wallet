import { t } from "@backend-utils";
import type { Static } from "elysia";
import {
    BudgetConfigSchema,
    CampaignMetadataSchema,
    CampaignRuleDefinitionSchema,
} from "../../domain/campaign/schemas";

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
