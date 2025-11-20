import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_protected/tokens/send")({
    component: lazyRouteComponent(() =>
        import("@/module/tokens/page/TokensSendPage").then((m) => ({
            default: m.TokensSendPage,
        }))
    ),
    pendingComponent: PageLoader,
});
