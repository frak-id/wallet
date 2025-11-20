import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_protected/tokens/receive")({
    component: lazyRouteComponent(
        () => import("@/module/tokens/page/TokensReceivePage"),
        "TokensReceivePage"
    ),
    pendingComponent: PageLoader,
});
