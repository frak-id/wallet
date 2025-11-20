import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/components/common/PageLoader";

export const Route = createFileRoute("/")({
    component: lazyRouteComponent(() =>
        import("@/pages/LandingPage").then((m) => ({
            default: m.LandingPage,
        }))
    ),
    pendingComponent: PageLoader,
});
