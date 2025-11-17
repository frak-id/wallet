import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { loadCampaignData, validateDraftCampaign } from "@/middleware/campaign";

export const Route = createFileRoute("/campaigns/draft/$campaignId/metrics")({
    // Auth only in beforeLoad
    beforeLoad: requireAuth,
    // Data fetching + validation in loader
    loader: async ({ params }) => {
        return loadCampaignData({
            params,
            validateState: validateDraftCampaign(params.campaignId),
        });
    },
    // Cache configuration
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsDraftMetricsPage")
    ),
});
