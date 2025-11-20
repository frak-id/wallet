import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { queryClient } from "@/module/common/provider/RootProvider";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/metrics"
)({
    // Prefetch into TanStack Query cache with validation
    loader: ({ params }) => {
        return queryClient.ensureQueryData(
            campaignQueryOptions(
                params.campaignId,
                validateDraftCampaign(params.campaignId)
            )
        );
    },
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsDraftMetricsPage"),
        "CampaignsDraftMetricsPage"
    ),
});
