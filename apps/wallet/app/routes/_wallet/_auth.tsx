import { getSafeSession } from "@frak-labs/wallet-shared";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";

export const Route = createFileRoute("/_wallet/_auth")({
    component: AuthenticationLayout,
    beforeLoad: async ({ location }) => {
        // Check if user is already authenticated
        // Use getSafeSession() to handle cases where Zustand store hasn't hydrated from localStorage yet
        const session = getSafeSession();
        if (session?.token) {
            // Check if there's a pairing ID in search params
            const search = new URLSearchParams(location.search);
            const pairingId = search.get("id");

            throw redirect({
                to: pairingId ? "/pairing" : "/wallet",
                replace: true,
            });
        }
    },
});

function AuthenticationLayout() {
    return (
        <GlobalLayout>
            <Outlet />
        </GlobalLayout>
    );
}
