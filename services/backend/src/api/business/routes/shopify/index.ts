import { extractShopDomain } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    CampaignContext,
    CampaignResponseSchema,
    type CampaignRuleDefinition,
    type CampaignStatus,
} from "../../../../domain/campaign";
import type {
    BudgetConfig,
    BudgetUsed,
} from "../../../../domain/campaign/schemas";
import { MerchantContext } from "../../../../domain/merchant";
import { OrchestrationContext } from "../../../../orchestration/context";
import { CampaignStatsResponseSchema } from "../../../../orchestration/schemas/campaignStatsSchemas";
import { shopifySessionContext } from "../../middleware/shopifySession";

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

export const shopifyRoutes = new Elysia({ prefix: "/shopify" })
    .use(shopifySessionContext)
    .get(
        "/merchant",
        async ({ shopifySession }) => {
            if (!shopifySession) {
                return status(401, "Authentication required");
            }

            const shopDomain = extractShopDomain(shopifySession.dest);
            if (!shopDomain) {
                return status(400, "Invalid shop domain");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findByDomain(
                    shopDomain
                );
            if (!merchant) {
                return status(404, "Merchant not found for this shop");
            }

            return {
                id: merchant.id,
                domain: merchant.domain,
                name: merchant.name,
                bankAddress: merchant.bankAddress,
                defaultRewardToken: merchant.defaultRewardToken,
                config: merchant.config,
                verifiedAt: merchant.verifiedAt?.toISOString() ?? null,
                createdAt: merchant.createdAt?.toISOString() ?? null,
            };
        },
        {
            response: {
                200: t.Object({
                    id: t.String(),
                    domain: t.String(),
                    name: t.String(),
                    bankAddress: t.Union([t.Hex(), t.Null()]),
                    defaultRewardToken: t.Hex(),
                    config: t.Union([t.Object({}), t.Null()]),
                    verifiedAt: t.Union([t.String(), t.Null()]),
                    createdAt: t.Union([t.String(), t.Null()]),
                }),
                400: t.String(),
                401: t.String(),
                404: t.String(),
            },
        }
    )
    .get(
        "/merchant/campaigns",
        async ({ shopifySession, query }) => {
            if (!shopifySession) {
                return status(401, "Authentication required");
            }

            const shopDomain = extractShopDomain(shopifySession.dest);
            if (!shopDomain) {
                return status(400, "Invalid shop domain");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findByDomain(
                    shopDomain
                );
            if (!merchant) {
                return status(404, "Merchant not found for this shop");
            }

            const statusFilter = query.status
                ? (query.status.split(",") as CampaignStatus[])
                : undefined;

            const campaigns =
                await CampaignContext.services.management.getByMerchant(
                    merchant.id,
                    statusFilter
                );

            return { campaigns: campaigns.map(formatCampaign) };
        },
        {
            query: t.Object({
                status: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({ campaigns: t.Array(CampaignResponseSchema) }),
                400: t.String(),
                401: t.String(),
                404: t.String(),
            },
        }
    )
    .get(
        "/merchant/campaigns/stats",
        async ({ shopifySession }) => {
            if (!shopifySession) {
                return status(401, "Authentication required");
            }

            const shopDomain = extractShopDomain(shopifySession.dest);
            if (!shopDomain) {
                return status(400, "Invalid shop domain");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findByDomain(
                    shopDomain
                );
            if (!merchant) {
                return status(404, "Merchant not found for this shop");
            }

            const stats =
                await OrchestrationContext.orchestrators.campaignStats.getStatsForMerchant(
                    merchant.id
                );

            return { stats };
        },
        {
            response: {
                200: CampaignStatsResponseSchema,
                400: t.String(),
                401: t.String(),
                404: t.String(),
            },
        }
    );
