import { createFileRoute } from "@tanstack/react-router";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId"
)({
    errorComponent: CampaignError,
});
