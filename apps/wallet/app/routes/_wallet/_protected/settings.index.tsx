import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/settings/")({
    component: lazyRouteComponent(
        () => import("@/module/settings/page/SettingsPage"),
        "SettingsPage"
    ),
});
