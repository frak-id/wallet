import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

type PairingSearch = {
    id?: string;
};

export const Route = createFileRoute("/_wallet/_protected/pairing")({
    component: lazyRouteComponent(() =>
        import("@/module/pairing/page/PairingPage").then((m) => ({
            default: m.PairingPage,
        }))
    ),
    pendingComponent: PageLoader,
    validateSearch: (search: Record<string, unknown>): PairingSearch => {
        return {
            id: (search.id as string) || "",
        };
    },
});
