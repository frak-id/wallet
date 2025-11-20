import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteError } from "@/module/common/component/RouteError";

export const Route = createFileRoute("/_restricted/campaigns/new")({
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsNewPage"),
        "CampaignsNewPage"
    ),
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Failed to Create Campaign"
            fallbackPath="/campaigns/list"
            fallbackLabel="Back to Campaigns"
        />
    ),
});
