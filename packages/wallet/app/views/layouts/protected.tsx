import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Outlet } from "react-router";
import { TargetPairingState } from "../../module/pairing/component/TargetPairingState";

export default function ProtectedLayout() {
    return (
        <AuthRestricted requireAuthenticated={true}>
            <GlobalLayout navigation={true}>
                <TargetPairingState />
                <Outlet />
            </GlobalLayout>
        </AuthRestricted>
    );
}
