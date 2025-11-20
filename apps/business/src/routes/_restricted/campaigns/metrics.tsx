import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { DataLoadError } from "@/module/common/component/RouteError";

export const Route = createFileRoute("/_restricted/campaigns/metrics")({
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsMetricsPage"),
        "CampaignsMetricsPage"
    ),
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="campaign metrics" />
    ),
});
