import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    MerchantIdParamSchema,
    OverviewAnalyticsResponseSchema,
    OverviewSummaryResponseSchema,
    OverviewWindowQuerySchema,
} from "../../schemas";
import { businessSessionContext } from "../middleware/session";

export const merchantCampaignOverviewRoutes = new Elysia({
    prefix: "/:merchantId/campaigns/overview",
})
    .use(businessSessionContext)
    .get(
        "/summary",
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

            return OrchestrationContext.orchestrators.campaignOverview.getSummary(
                merchantId,
                { from: query.from, to: query.to }
            );
        },
        {
            params: MerchantIdParamSchema,
            query: OverviewWindowQuerySchema,
            response: {
                200: OverviewSummaryResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .get(
        "/analytics",
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

            return OrchestrationContext.orchestrators.campaignAnalytics.getAnalytics(
                merchantId,
                { from: query.from, to: query.to }
            );
        },
        {
            params: MerchantIdParamSchema,
            query: OverviewWindowQuerySchema,
            response: {
                200: OverviewAnalyticsResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    );
