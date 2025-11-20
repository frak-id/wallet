import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/tokens/send")({
    component: lazyRouteComponent(
        () => import("@/module/tokens/page/TokensSendPage"),
        "TokensSendPage"
    ),
});
