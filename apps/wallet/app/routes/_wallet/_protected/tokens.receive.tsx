import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/tokens/receive")({
    component: lazyRouteComponent(
        () => import("@/module/tokens/page/TokensReceivePage"),
        "TokensReceivePage"
    ),
});
