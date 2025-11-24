import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/components/common/PageLoader";

export const Route = createFileRoute("/configuration")({
    component: lazyRouteComponent(() =>
        import("@/pages/ConfigurationPage").then((m) => ({
            default: m.ConfigurationPage,
        }))
    ),
    pendingComponent: PageLoader,
});
