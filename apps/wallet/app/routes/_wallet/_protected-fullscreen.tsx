import { getSafeSession } from "@frak-labs/wallet-shared";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/module/common/component/AppShell";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";

/**
 * Protected layout WITHOUT bottom navigation.
 * Use for any full-screen flow (pairing, referral creation, etc.) that
 * needs auth but should not show the tab bar.
 */
export const Route = createFileRoute("/_wallet/_protected-fullscreen")({
    component: ProtectedFullscreenLayout,
    beforeLoad: async ({ location }) => {
        const session = getSafeSession();
        if (!session?.token) {
            const search = Object.fromEntries(
                new URLSearchParams(location.search)
            );
            pendingActionsStore.getState().addAction({
                type: "navigation",
                to: location.pathname,
                search: Object.keys(search).length > 0 ? search : undefined,
            });
            throw redirect({
                to: "/register",
                replace: true,
            });
        }
    },
});

function ProtectedFullscreenLayout() {
    return (
        <AppShell navigation={false}>
            <Outlet />
        </AppShell>
    );
}
