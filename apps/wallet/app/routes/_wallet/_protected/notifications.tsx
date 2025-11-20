import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/notifications")({
    component: lazyRouteComponent(
        () => import("@/module/notification/page/NotificationsPage"),
        "NotificationsPage"
    ),
});
