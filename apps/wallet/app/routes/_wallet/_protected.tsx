import {
    getSafeSession,
    OriginPairingState,
    selectDistantWebauthnSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { TargetPairingState } from "@/module/pairing/component/TargetPairingState";

export const Route = createFileRoute("/_wallet/_protected")({
    component: ProtectedLayout,
    beforeLoad: async () => {
        // Check if user is authenticated
        // Use getSafeSession() to handle cases where Zustand store hasn't hydrated from localStorage yet
        const session = getSafeSession();
        if (!session?.token) {
            throw redirect({
                to: "/register",
                replace: true,
            });
        }
    },
});

function ProtectedLayout() {
    const session = sessionStore(selectDistantWebauthnSession);
    const Component =
        session?.type === "distant-webauthn"
            ? OriginPairingState
            : TargetPairingState;

    return (
        <GlobalLayout navigation={true}>
            <Component type="wallet" />
            <Outlet />
        </GlobalLayout>
    );
}
