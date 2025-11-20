import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_protected/history")({
    component: lazyRouteComponent(
        () => import("@/module/history/page/HistoryPage"),
        "HistoryPage"
    ),
    pendingComponent: PageLoader,
});
