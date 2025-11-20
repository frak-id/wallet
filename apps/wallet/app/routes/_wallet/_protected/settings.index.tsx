import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_protected/settings/")({
    component: lazyRouteComponent(
        () => import("@/module/settings/page/SettingsPage"),
        "SettingsPage"
    ),
    pendingComponent: PageLoader,
});
