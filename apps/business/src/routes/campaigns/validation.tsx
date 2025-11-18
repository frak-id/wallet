import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/validation")({
    beforeLoad: requireAuth,
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsValidationPage")
    ),
    pendingComponent: () => (
        <RestrictedLayout>
            <Skeleton />
        </RestrictedLayout>
    ),
});
