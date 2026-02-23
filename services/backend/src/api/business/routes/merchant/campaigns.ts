import type { BudgetUsed } from "@backend-domain/campaign/schemas";
import { tokenMetadataRepository } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { currentStablecoinsList } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import type { Address } from "viem";
import {
    type BudgetConfig,
    BudgetConfigSchema,
    CampaignContext,
    CampaignMetadataSchema,
    CampaignResponseSchema,
    type CampaignRuleDefinition,
    CampaignRuleDefinitionSchema,
    type CampaignStatus,
} from "../../../../domain/campaign";
import {
    CampaignBankContext,
    computeDistributionStatus,
} from "../../../../domain/campaign-bank";
import type { DistributionStatus } from "../../../../domain/campaign-bank/schemas";
import { MerchantContext } from "../../../../domain/merchant";
import { businessSessionContext } from "../../middleware/session";

function resolveRewardTokens(
    rule: CampaignRuleDefinition,
    defaultRewardToken: Address | null
): CampaignRuleDefinition {
    return {
        ...rule,
        rewards: rule.rewards.map((reward) => ({
            ...reward,
            token: reward.token ?? defaultRewardToken ?? undefined,
        })),
    };
}

async function getTokenDecimals(): Promise<Map<Address, number>> {
    const decimals = new Map<Address, number>();

    await Promise.all(
        currentStablecoinsList.map(async (token) => {
            const d = await tokenMetadataRepository.getDecimals({ token });
            decimals.set(token, d);
        })
    );

    return decimals;
}

function formatCampaign(
    campaign: {
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
    },
    bankDistributionStatus?: DistributionStatus
) {
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
        bankDistributionStatus: bankDistributionStatus ?? null,
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
        async ({
            params: { merchantId },
            query,
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const statusFilter = query.status
                ? (query.status.split(",") as CampaignStatus[])
                : undefined;

            const [campaigns, bankStatus] = await Promise.all([
                CampaignContext.services.management.getByMerchant(
                    merchantId,
                    statusFilter
                ),
                CampaignBankContext.services.campaignBank.getBankStatus(
                    merchantId
                ),
            ]);

            let distributionStatus: DistributionStatus | undefined;
            if (bankStatus.bankAddress) {
                const [onChainState, tokenDecimals] = await Promise.all([
                    CampaignBankContext.repositories.campaignBank.getBankOnChainState(
                        bankStatus.bankAddress,
                        currentStablecoinsList
                    ),
                    getTokenDecimals(),
                ]);
                distributionStatus = computeDistributionStatus(
                    onChainState,
                    tokenDecimals
                );
            } else {
                distributionStatus = computeDistributionStatus(null, new Map());
            }

            return {
                campaigns: campaigns.map((campaign) =>
                    formatCampaign(campaign, distributionStatus)
                ),
            };
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
        async ({
            params: { merchantId, campaignId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const campaign =
                await CampaignContext.services.management.getById(campaignId);
            if (!campaign || campaign.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            const bankStatus =
                await CampaignBankContext.services.campaignBank.getBankStatus(
                    merchantId
                );

            let distributionStatus: DistributionStatus | undefined;
            if (bankStatus.bankAddress) {
                const [onChainState, tokenDecimals] = await Promise.all([
                    CampaignBankContext.repositories.campaignBank.getBankOnChainState(
                        bankStatus.bankAddress,
                        currentStablecoinsList
                    ),
                    getTokenDecimals(),
                ]);
                distributionStatus = computeDistributionStatus(
                    onChainState,
                    tokenDecimals
                );
            } else {
                distributionStatus = computeDistributionStatus(null, new Map());
            }

            return formatCampaign(campaign, distributionStatus);
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
        async ({
            params: { merchantId },
            body,
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            const rule = resolveRewardTokens(
                body.rule as CampaignRuleDefinition,
                merchant?.defaultRewardToken ?? null
            );

            const result = await CampaignContext.services.management.create({
                merchantId,
                name: body.name,
                rule,
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

            return formatCampaign(result.campaign, undefined);
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
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const existing =
                await CampaignContext.services.management.getById(campaignId);
            if (!existing || existing.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            let resolvedRule = body.rule as CampaignRuleDefinition | undefined;
            if (resolvedRule) {
                const merchant =
                    await MerchantContext.repositories.merchant.findById(
                        merchantId
                    );
                resolvedRule = resolveRewardTokens(
                    resolvedRule,
                    merchant?.defaultRewardToken ?? null
                );
            }

            const result = await CampaignContext.services.management.update(
                campaignId,
                {
                    name: body.name,
                    rule: resolvedRule,
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

            return formatCampaign(result.campaign, undefined);
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
        async ({
            params: { merchantId, campaignId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
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

            return formatCampaign(result.campaign, undefined);
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
        async ({
            params: { merchantId, campaignId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
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

            return formatCampaign(result.campaign, undefined);
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
        async ({
            params: { merchantId, campaignId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
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

            return formatCampaign(result.campaign, undefined);
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
        async ({
            params: { merchantId, campaignId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
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

            return formatCampaign(result.campaign, undefined);
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
        async ({
            params: { merchantId, campaignId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
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
