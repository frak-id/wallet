import { getSafeSession } from "@frak-labs/wallet-shared";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/module/common/component/AppShell";

export const Route = createFileRoute("/_wallet/_auth")({
    component: AuthenticationLayout,
    beforeLoad: async () => {
        // If already authenticated, redirect to wallet.
        // Pending actions (from deep links, pairing) are handled by
        // executePendingActions in the post-auth flow.
        const session = getSafeSession();
        if (session?.token) {
            throw redirect({ to: "/wallet", replace: true });
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
