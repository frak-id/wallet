import { OriginPairingState } from "@frak-labs/wallet-shared/pairing/component/OriginPairingState";
import {
    selectDistantWebauthnSession,
    sessionStore,
} from "@frak-labs/wallet-shared/stores/sessionStore";
import { Outlet } from "react-router";
import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { TargetPairingState } from "@/module/pairing/component/TargetPairingState";

export default function ProtectedLayout() {
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
