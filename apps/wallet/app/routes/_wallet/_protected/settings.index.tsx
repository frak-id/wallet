import { createFileRoute } from "@tanstack/react-router";
import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { RemoveAllNotification } from "@/module/notification/component/RemoveAllNotification";
import { PairingList } from "@/module/pairing/component/PairingList";
import { CloseSession } from "@/module/settings/component/CloseSession";
import { PrivateKey } from "@/module/settings/component/PrivateKey";
import { RecoveryLink } from "@/module/settings/component/Recovery";
import { SessionInfo } from "@/module/settings/component/SessionInfo";

export const Route = createFileRoute("/_wallet/_protected/settings/")({
    component: Settings,
});

function Settings() {
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
            <CloseSession />
            <RecoveryLink />
            <RemoveAllNotification />
            <PrivateKey />
            <PairingList />
        </Grid>
    );
}
