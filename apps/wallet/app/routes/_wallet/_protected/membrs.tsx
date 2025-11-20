import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/membrs")({
    component: lazyRouteComponent(
        () => import("@/module/membrs/page/MembrsPage"),
        "MembrsPage"
    ),
});
