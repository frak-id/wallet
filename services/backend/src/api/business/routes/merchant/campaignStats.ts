import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../../orchestration/context";
import {
    CampaignStatsResponseSchema,
    MerchantIdParamSchema,
} from "../../../schemas";
import { businessSessionContext } from "../../middleware/session";

export const merchantCampaignStatsRoutes = new Elysia({
    prefix: "/:merchantId/campaigns/stats",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({
            params: { merchantId },
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

            const stats =
                await OrchestrationContext.orchestrators.campaignStats.getStatsForMerchant(
                    merchantId
                );

            return { stats };
        },
        {
            params: MerchantIdParamSchema,
            response: {
                200: CampaignStatsResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    );
