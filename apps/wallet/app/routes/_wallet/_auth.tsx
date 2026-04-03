import { getSafeSession } from "@frak-labs/wallet-shared";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/module/common/component/AppShell";
import {
    pendingActionsStore,
    selectPendingPairingId,
} from "@/module/pending-actions/stores/pendingActionsStore";

export const Route = createFileRoute("/_wallet/_auth")({
    component: AuthenticationLayout,
    beforeLoad: async ({ location }) => {
        // Check if user is already authenticated
        // Use getSafeSession() to handle cases where Zustand store hasn't hydrated from localStorage yet
        const session = getSafeSession();
        if (session?.token) {
            // Check if there's a pairing ID in search params
            const search = new URLSearchParams(location.search);
            const searchPairingId = search.get("id");

            if (searchPairingId) {
                pendingActionsStore.getState().addAction({
                    type: "pairing",
                    pairingId: searchPairingId,
                });
            }

            const pairingId =
                searchPairingId ||
                selectPendingPairingId(pendingActionsStore.getState());

            throw redirect({
                to: pairingId ? "/pairing" : "/wallet",
                replace: true,
            });
        }

        const search = new URLSearchParams(location.search);
        const pairingId = search.get("id");
        if (pairingId) {
            pendingActionsStore.getState().addAction({
                type: "pairing",
                pairingId,
            });
        }
    },
});

function AuthenticationLayout() {
    return (
        <AppShell auth>
            <Outlet />
        </AppShell>
    );
}
