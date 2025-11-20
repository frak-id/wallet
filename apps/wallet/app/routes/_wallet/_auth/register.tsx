import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_auth/register")({
    component: lazyRouteComponent(
        () => import("@/module/authentication/page/RegisterPage"),
        "RegisterPage"
    ),
});
