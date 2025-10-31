import { createFileRoute } from "@tanstack/react-router";
import { AuthenticationGated } from "@/module/embedded/component/AuthenticationGated";
import { EmbeddedPurchaseTracker } from "@/module/embedded/component/PurchaseTracker";

export const Route = createFileRoute("/embedded/_layout/purchase-tracker")({
    component: EmbeddedPurchaseTrackerPage,
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

function EmbeddedPurchaseTrackerPage() {
    return (
        <AuthenticationGated action="create your purchase tracker">
            <EmbeddedPurchaseTracker />
        </AuthenticationGated>
    );
}
