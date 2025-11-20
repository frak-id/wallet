import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_protected/membrs")({
    component: lazyRouteComponent(() =>
        import("@/module/membrs/page/MembrsPage").then((m) => ({
            default: m.MembrsPage,
        }))
    ),
    pendingComponent: PageLoader,
});
