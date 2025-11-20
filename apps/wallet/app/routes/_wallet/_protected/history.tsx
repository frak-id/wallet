import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/history")({
    component: lazyRouteComponent(
        () => import("@/module/history/page/HistoryPage"),
        "HistoryPage"
    ),
});
