import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    CampaignDetailsResponseSchema,
    MerchantCampaignParamSchema,
} from "../../schemas";
import { businessSessionContext } from "../middleware/session";
import { getCampaignForMerchant } from "./campaigns";

export const merchantCampaignDetailsRoutes = new Elysia({
    prefix: "/:merchantId/campaigns/:campaignId/details",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId, campaignId } }) => {
            const campaign = await getCampaignForMerchant(
                merchantId,
                campaignId
            );
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
