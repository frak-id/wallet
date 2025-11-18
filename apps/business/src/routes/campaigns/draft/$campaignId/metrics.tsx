import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { queryClient } from "@/module/common/provider/RootProvider";

export const Route = createFileRoute("/campaigns/draft/$campaignId/metrics")({
    // Auth only in beforeLoad
    beforeLoad: requireAuth,
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
        () => import("@/module/campaigns/page/CampaignsDraftMetricsPage")
    ),
    pendingComponent: () => (
        <RestrictedLayout>
            <Skeleton />
        </RestrictedLayout>
    ),
});
