import { createFileRoute, Link } from "@tanstack/react-router";
import { Logout } from "@/module/authentication/component/Logout";
import { BiometricSettings } from "@/module/biometrics";
import { Grid } from "@/module/common/component/Grid";
import { MoneriumConnect } from "@/module/monerium/component/MoneriumConnect";
import {
    moneriumStore,
    selectIsConnected,
    selectProfileState,
} from "@/module/monerium/store/moneriumStore";
import { RemoveAllNotification } from "@/module/notification/component/RemoveAllNotification";
import { PairingList } from "@/module/pairing/component/PairingList";
import { LegalLinks } from "@/module/settings/component/LegalLinks";
import { PrivateKey } from "@/module/settings/component/PrivateKey";
import { RecoveryLink } from "@/module/settings/component/Recovery";
import { SessionInfo } from "@/module/settings/component/SessionInfo";

export const Route = createFileRoute("/_wallet/_protected/settings/")({
    component: SettingsPage,
});

function MoneriumSection() {
    const isConnected = moneriumStore(selectIsConnected);
    const profileState = moneriumStore(selectProfileState);

    return (
        <>
            <MoneriumConnect />
            {isConnected && profileState === "approved" && (
                <Link to="/monerium/offramp">Offramp</Link>
            )}
        </>
    );
}

function SettingsPage() {
    return (
        <Grid
            footer={
                <>
                    {/* <EditProfile /> */}
                    <Logout />
                </>
            }
        >
            <SessionInfo />
            <BiometricSettings />
            <RecoveryLink />
            <RemoveAllNotification />
            <PrivateKey />
            <PairingList />
            <MoneriumSection />
            <LegalLinks />
        </Grid>
    );
}
