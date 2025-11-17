import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";

export const Route = createFileRoute("/campaigns/validation")({
    beforeLoad: requireAuth,
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsValidationPage")
    ),
});
