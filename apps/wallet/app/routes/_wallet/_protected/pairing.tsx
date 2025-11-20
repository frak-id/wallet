import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

type PairingSearch = {
    id?: string;
};

export const Route = createFileRoute("/_wallet/_protected/pairing")({
    component: lazyRouteComponent(
        () => import("@/module/pairing/page/PairingPage"),
        "PairingPage"
    ),
    validateSearch: (search: Record<string, unknown>): PairingSearch => {
        return {
            id: (search.id as string) || "",
        };
    },
});
