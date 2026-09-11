import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ExplorerPage } from "@/module/explorer/component/ExplorerPage";
import { useGetExplorerMerchantById } from "@/module/explorer/hook/useGetExplorerMerchantById";
import { modalStore } from "@/module/stores/modalStore";

/**
 * Deep link target for campaign-launch notifications: opens the explorer with
 * the merchant's `explorerDetail` modal already open, list underneath.
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
        // Act once the lookup has settled (found, not-found, or errored) — NOT
        // on `isLoading`, which is briefly false before data attaches. Always
        // redirect to /explorer first: no modal is open yet, so
        // `useHardwareBack`'s blocker stays inactive, and returning the URL
        // keeps a repeat deep link a real navigation instead of a no-op.
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
