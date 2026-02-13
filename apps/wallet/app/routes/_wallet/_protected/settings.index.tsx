import { createFileRoute } from "@tanstack/react-router";
import { Logout } from "@/module/authentication/component/Logout";
import { BiometricSettings } from "@/module/biometrics";
import { Grid } from "@/module/common/component/Grid";
import { RemoveAllNotification } from "@/module/notification/component/RemoveAllNotification";
import { PairingList } from "@/module/pairing/component/PairingList";
import { PrivateKey } from "@/module/settings/component/PrivateKey";
import { RecoveryLink } from "@/module/settings/component/Recovery";
import { SessionInfo } from "@/module/settings/component/SessionInfo";

export const Route = createFileRoute("/_wallet/_protected/settings/")({
    component: SettingsPage,
});

/**
 * SettingsPage
 *
 * Main settings page displaying wallet configuration options
 *
 * @returns {JSX.Element} The rendered settings page
 */
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
        </Grid>
    );
}
