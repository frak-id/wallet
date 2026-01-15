import { createFileRoute } from "@tanstack/react-router";
import { EmbeddedPurchaseTracker } from "@/module/embedded/component/PurchaseTracker";

export const Route = createFileRoute("/embedded/_layout/purchase-tracker")({
    component: EmbeddedPurchaseTracker,
    validateSearch: (search: Record<string, unknown>) => {
        // Required parameters
        const mid = search.mid as string | undefined;

        // Optional parameters (pid now optional - only for on-chain operations)
        const pid = search.pid as string | undefined;
        const p = search.p as string | undefined;
        const s = search.s as string | undefined;

        return {
            mid: mid ?? "",
            pid,
            p,
            s,
        };
    },
});
