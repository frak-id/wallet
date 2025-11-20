import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_auth/register")({
    component: lazyRouteComponent(
        () => import("@/module/authentication/page/RegisterPage"),
        "RegisterPage"
    ),
    pendingComponent: PageLoader,
});
