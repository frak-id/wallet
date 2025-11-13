import {
    OriginPairingState,
    selectDistantWebauthnSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { TargetPairingState } from "@/module/pairing/component/TargetPairingState";

export const Route = createFileRoute("/_wallet/_protected")({
    component: ProtectedLayout,
    beforeLoad: async () => {
        // Check if user is authenticated
        const session = sessionStore.getState().session;
        if (!session?.token) {
            throw redirect({
                to: "/register",
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
        <AuthRestricted requireAuthenticated={true}>
            <GlobalLayout navigation={true}>
                <Component type="wallet" />
                <Outlet />
            </GlobalLayout>
        </AuthRestricted>
    );
}
