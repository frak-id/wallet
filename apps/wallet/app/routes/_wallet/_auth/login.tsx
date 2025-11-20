import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_auth/login")({
    component: lazyRouteComponent(
        () => import("@/module/authentication/page/LoginPage"),
        "LoginPage"
    ),
});
