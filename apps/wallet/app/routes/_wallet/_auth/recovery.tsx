import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_auth/recovery")({
    component: lazyRouteComponent(
        () => import("@/module/recovery/page/RecoveryPage"),
        "RecoveryPage"
    ),
});
