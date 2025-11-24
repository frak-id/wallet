import { createFileRoute } from "@tanstack/react-router";
import { EmbeddedPurchaseTracker } from "@/module/embedded/component/PurchaseTracker";

export const Route = createFileRoute("/embedded/_layout/purchase-tracker")({
    component: EmbeddedPurchaseTracker,
    validateSearch: (search: Record<string, unknown>) => {
        // Required parameters
        const pid = search.pid as string | undefined;

        // Optional parameters
        const p = search.p as string | undefined;
        const s = search.s as string | undefined;

        return {
            pid: pid ?? "",
            p,
            s,
        };
    },
});
