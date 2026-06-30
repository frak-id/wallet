import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ExplorerPage } from "@/module/explorer/component/ExplorerPage";
import { useGetExplorerMerchantById } from "@/module/explorer/hook/useGetExplorerMerchantById";
import { modalStore } from "@/module/stores/modalStore";

/**
 * Deep link target for campaign-launch notifications: opens the explorer with
 * the merchant's detail modal already open. Resolves the merchant by id and
 * opens the `explorerDetail` modal over this route, which renders the explorer
 * list underneath so closing the modal reveals it.
 *
 * Flow: resolve the merchant, redirect to the canonical `/explorer` while NO
 * modal is open (so `useHardwareBack`'s blocker stays inactive and won't eat
 * the modal), then open the `explorerDetail` modal once navigation settles.
 *
 * Returning the URL to `/explorer` is also what makes warm-start work: a repeat
 * deep link to `/explorer/{id}` is then always a real location change (vs a
 * no-op same-URL navigation), so the route re-mounts and re-fires every time.
 *
 * Shipping this route now lets backend notifications point at
 * `/explorer/{merchantId}` later without a new app release.
 */
export const Route = createFileRoute(
    "/_wallet/_protected/explorer_/$merchantId"
)({
    component: ExplorerMerchantPage,
});

function ExplorerMerchantPage() {
    const { merchantId } = Route.useParams();
    const navigate = useNavigate();
    const { merchant, isSettled } = useGetExplorerMerchantById(merchantId);
    const handled = useRef(false);

    useEffect(() => {
        // Act once the lookup has settled (found, not-found, or errored) — NOT on
        // `isLoading`, which is briefly false before data attaches and would
        // fire with no merchant. Always redirect to /explorer: it un-strands a
        // failed lookup (list, no modal) and keeps warm-start working (the URL
        // returns to /explorer, so a repeat deep link is a real navigation, not
        // a no-op). Redirect first (no modal open → useHardwareBack's blocker is
        // inactive), then open the modal only when a merchant resolved.
        if (handled.current || !isSettled) return;
        handled.current = true;
        const resolved = merchant;
        navigate({ to: "/explorer", replace: true })
            .then(() => {
                if (resolved) {
                    modalStore.getState().openModal({
                        id: "explorerDetail",
                        merchant: resolved,
                    });
                }
            })
            .catch(() => {});
    }, [isSettled, merchant, navigate]);

    // Render the explorer page during the brief resolve window so the deep link
    // looks identical to `/explorer` before the redirect + modal open.
    return <ExplorerPage />;
}
