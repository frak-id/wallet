import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { loadCampaign, validateDraftCampaign } from "@/middleware/campaign";

export const Route = createFileRoute("/campaigns/draft/$campaignId/metrics")({
    beforeLoad: async ({ params, location }) => {
        return loadCampaign({
            params,
            location,
            validateState: validateDraftCampaign(params.campaignId),
        });
    },
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsDraftMetricsPage")
    ),
});
