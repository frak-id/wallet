import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    CampaignDetailsResponseSchema,
    MerchantCampaignParamSchema,
} from "../../schemas";
import { businessSessionContext } from "../middleware/session";
import { getOwnedCampaign } from "./campaigns";

export const merchantCampaignDetailsRoutes = new Elysia({
    prefix: "/:merchantId/campaigns/:campaignId/details",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId, campaignId } }) => {
            // Ownership check: confirm the campaign belongs to this merchant
            // before exposing its aggregated stats. Mirrors the pattern in
            // `GET /:merchantId/campaigns/:campaignId` (campaigns.ts).
            const campaign = await getOwnedCampaign(merchantId, campaignId);
            if (!campaign) {
                return status(404, "Campaign not found");
            }

            return OrchestrationContext.orchestrators.campaignStats.getDetailsForCampaign(
                merchantId,
                campaignId
            );
        },
        {
            requireMerchantAccess: true,
            params: MerchantCampaignParamSchema,
            response: {
                200: CampaignDetailsResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
