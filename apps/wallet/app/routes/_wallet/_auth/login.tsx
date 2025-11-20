import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_auth/login")({
    component: lazyRouteComponent(
        () => import("@/module/authentication/page/LoginPage"),
        "LoginPage"
    ),
    pendingComponent: PageLoader,
});
