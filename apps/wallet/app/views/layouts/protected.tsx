import { useAtomValue } from "jotai";
import { Outlet } from "react-router";
import { distantWebauthnSessionAtom } from "@/module/common/atoms/session";
import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { OriginPairingState } from "@/module/pairing/component/OriginPairingState";
import { TargetPairingState } from "@/module/pairing/component/TargetPairingState";

export default function ProtectedLayout() {
    const session = useAtomValue(distantWebauthnSessionAtom);
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
