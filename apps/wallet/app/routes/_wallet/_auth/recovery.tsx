import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_auth/recovery")({
    component: lazyRouteComponent(
        () => import("@/module/recovery/page/RecoveryPage"),
        "RecoveryPage"
    ),
    pendingComponent: PageLoader,
});
