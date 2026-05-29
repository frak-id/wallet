import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { CampaignContext } from "../../../domain/campaign";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    CampaignDetailsResponseSchema,
    MerchantCampaignParamSchema,
} from "../../schemas";
import { businessSessionContext } from "../middleware/session";

export const merchantCampaignDetailsRoutes = new Elysia({
    prefix: "/:merchantId/campaigns/:campaignId/details",
})
    .use(businessSessionContext)
    .get(
        "",
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

            // Ownership check: confirm the campaign belongs to this merchant
            // before exposing its aggregated stats. Mirrors the pattern in
            // `GET /:merchantId/campaigns/:campaignId` (campaigns.ts).
            const campaign =
                await CampaignContext.services.management.getById(campaignId);
            if (!campaign || campaign.merchantId !== merchantId) {
                return status(404, "Campaign not found");
            }

            return OrchestrationContext.orchestrators.campaignDetails.getDetailsForCampaign(
                merchantId,
                campaignId
            );
        },
        {
            params: MerchantCampaignParamSchema,
            response: {
                200: CampaignDetailsResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
