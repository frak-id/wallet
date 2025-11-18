import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_restricted/campaigns/new")({
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsNewPage")
    ),
    pendingComponent: () => <Skeleton />,
});
