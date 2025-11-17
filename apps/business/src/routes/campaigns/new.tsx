import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";

export const Route = createFileRoute("/campaigns/new")({
    beforeLoad: requireAuth,
    component: lazyRouteComponent(
        () => import("@/module/campaigns/page/CampaignsNewPage")
    ),
});
