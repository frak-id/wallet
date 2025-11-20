import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_protected/notifications")({
    component: lazyRouteComponent(() =>
        import("@/module/notification/page/NotificationsPage").then((m) => ({
            default: m.NotificationsPage,
        }))
    ),
    pendingComponent: PageLoader,
});
