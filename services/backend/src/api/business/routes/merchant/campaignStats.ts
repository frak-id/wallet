import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../../domain/merchant";
import { OrchestrationContext } from "../../../../orchestration/context";
import { CampaignStatsResponseSchema } from "../../../../orchestration/schemas/campaignStatsSchemas";
import { businessSessionContext } from "../../middleware/session";

export const merchantCampaignStatsRoutes = new Elysia({
    prefix: "/:merchantId/campaigns/stats",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId }, businessSession }) => {
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

            const stats =
                await OrchestrationContext.orchestrators.campaignStats.getStatsForMerchant(
                    merchantId
                );

            return { stats };
        },
        {
            params: t.Object({ merchantId: t.String() }),
            response: {
                200: CampaignStatsResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    );
