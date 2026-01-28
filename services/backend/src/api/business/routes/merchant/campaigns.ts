import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    BudgetConfig,
    BudgetConfigSchema,
    CampaignContext,
    CampaignMetadataSchema,
    CampaignResponseSchema,
    type CampaignRuleDefinition,
    CampaignRuleDefinitionSchema,
    type CampaignStatus,
} from "../../../../domain/campaign";
import { MerchantContext } from "../../../../domain/merchant";
import { businessSessionContext } from "../../middleware/session";
import { BudgetUsed } from "@backend-domain/campaign/schemas";

function formatCampaign(campaign: {
    id: string;
    merchantId: string;
    name: string;
    status: CampaignStatus;
    priority: number;
    rule: CampaignRuleDefinition;
    metadata: unknown;
    budgetConfig: BudgetConfig | null;
    budgetUsed: BudgetUsed | null;
    expiresAt: Date | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}) {
    const budgetConfig = Array.isArray(campaign.budgetConfig)
        ? campaign.budgetConfig
        : null;
    const budgetUsed =
        campaign.budgetUsed &&
        typeof campaign.budgetUsed === "object" &&
        Object.keys(campaign.budgetUsed).length > 0
            ? campaign.budgetUsed
            : null;

    return {
        id: campaign.id,
        merchantId: campaign.merchantId,
        name: campaign.name,
        status: campaign.status,
        priority: campaign.priority,
        rule: campaign.rule,
        metadata: campaign.metadata ?? null,
        budgetConfig,
        budgetUsed,
        expiresAt: campaign.expiresAt?.toISOString() ?? null,
        publishedAt: campaign.publishedAt?.toISOString() ?? null,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
    };
}

export const merchantCampaignsRoutes = new Elysia({
    prefix: "/:merchantId/campaigns",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId }, query, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const statusFilter = query.status
                ? (query.status.split(",") as CampaignStatus[])
                : undefined;

            const campaigns =
                await CampaignContext.services.management.getByMerchant(
                    merchantId,
                    statusFilter
                );

            return { campaigns: campaigns.map(formatCampaign) };
        },
        {
            params: t.Object({ merchantId: t.String() }),
            query: t.Object({
                status: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({ campaigns: t.Array(CampaignResponseSchema) }),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .get(
        "/:campaignId",
        async ({ params: { merchantId, campaignId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const campaign =
                await CampaignContext.services.management.getById(campaignId);
            if (!campaign || campaign.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            return formatCampaign(campaign);
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            response: {
                200: CampaignResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "",
        async ({ params: { merchantId }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const result = await CampaignContext.services.management.create({
                merchantId,
                name: body.name,
                rule: body.rule as CampaignRuleDefinition,
                metadata: body.metadata,
                budgetConfig: body.budgetConfig,
                expiresAt: body.expiresAt
                    ? new Date(body.expiresAt)
                    : undefined,
                priority: body.priority,
            });

            if (!result.success) {
                return status(400, result.error);
            }

            return formatCampaign(result.campaign);
        },
        {
            params: t.Object({ merchantId: t.String() }),
            body: t.Object({
                name: t.String(),
                rule: CampaignRuleDefinitionSchema,
                metadata: t.Optional(CampaignMetadataSchema),
                budgetConfig: t.Optional(BudgetConfigSchema),
                expiresAt: t.Optional(t.String()),
                priority: t.Optional(t.Number()),
            }),
            response: {
                200: CampaignResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .put(
        "/:campaignId",
        async ({
            params: { merchantId, campaignId },
            body,
            businessSession,
        }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const existing =
                await CampaignContext.services.management.getById(campaignId);
            if (!existing || existing.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            const result = await CampaignContext.services.management.update(
                campaignId,
                {
                    name: body.name,
                    rule: body.rule as CampaignRuleDefinition | undefined,
                    metadata: body.metadata,
                    budgetConfig: body.budgetConfig,
                    expiresAt: body.expiresAt
                        ? new Date(body.expiresAt)
                        : body.expiresAt === null
                          ? null
                          : undefined,
                    priority: body.priority,
                }
            );

            if (!result.success) {
                return status(400, result.error);
            }

            return formatCampaign(result.campaign);
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            body: t.Object({
                name: t.Optional(t.String()),
                rule: t.Optional(CampaignRuleDefinitionSchema),
                metadata: t.Optional(CampaignMetadataSchema),
                budgetConfig: t.Optional(BudgetConfigSchema),
                expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
                priority: t.Optional(t.Number()),
            }),
            response: {
                200: CampaignResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "/:campaignId/publish",
        async ({ params: { merchantId, campaignId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const existing =
                await CampaignContext.services.management.getById(campaignId);
            if (!existing || existing.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            const result =
                await CampaignContext.services.management.publish(campaignId);

            if (!result.success) {
                return status(400, result.error);
            }

            return formatCampaign(result.campaign);
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            response: {
                200: CampaignResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "/:campaignId/pause",
        async ({ params: { merchantId, campaignId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const existing =
                await CampaignContext.services.management.getById(campaignId);
            if (!existing || existing.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            const result =
                await CampaignContext.services.management.pause(campaignId);

            if (!result.success) {
                return status(400, result.error);
            }

            return formatCampaign(result.campaign);
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            response: {
                200: CampaignResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "/:campaignId/resume",
        async ({ params: { merchantId, campaignId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const existing =
                await CampaignContext.services.management.getById(campaignId);
            if (!existing || existing.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            const result =
                await CampaignContext.services.management.resume(campaignId);

            if (!result.success) {
                return status(400, result.error);
            }

            return formatCampaign(result.campaign);
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            response: {
                200: CampaignResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "/:campaignId/archive",
        async ({ params: { merchantId, campaignId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const existing =
                await CampaignContext.services.management.getById(campaignId);
            if (!existing || existing.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            const result =
                await CampaignContext.services.management.archive(campaignId);

            if (!result.success) {
                return status(400, result.error);
            }

            return formatCampaign(result.campaign);
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            response: {
                200: CampaignResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .delete(
        "/:campaignId",
        async ({ params: { merchantId, campaignId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const existing =
                await CampaignContext.services.management.getById(campaignId);
            if (!existing || existing.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            const result =
                await CampaignContext.services.management.delete(campaignId);

            if (!result.success) {
                return status(400, result.error);
            }

            return { success: true };
        },
        {
            params: t.Object({
                merchantId: t.String(),
                campaignId: t.String(),
            }),
            response: {
                200: t.Object({ success: t.Boolean() }),
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
