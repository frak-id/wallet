import { getSafeSession } from "@frak-labs/wallet-shared";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/module/common/component/AppShell";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";

export const Route = createFileRoute("/_wallet/_protected")({
    component: ProtectedLayout,
    beforeLoad: async ({ location }) => {
        const session = getSafeSession();
        if (!session?.token) {
            // Preserve the intended destination for post-auth resume
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

function ProtectedLayout() {
    return (
        <AppShell navigation={true}>
            <Outlet />
        </AppShell>
    );
}
