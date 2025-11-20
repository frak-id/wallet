import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_restricted/campaigns/validation")({
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsValidationPage"),
        "CampaignsValidationPage"
    ),
});
