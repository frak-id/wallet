import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_auth/recovery")({
    component: lazyRouteComponent(() =>
        import("@/module/recovery/page/RecoveryPage").then((m) => ({
            default: m.RecoveryPage,
        }))
    ),
    pendingComponent: PageLoader,
});
