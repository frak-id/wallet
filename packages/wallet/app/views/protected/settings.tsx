import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { RemoveAllNotification } from "@/module/notification/component/RemoveAllNotification";
import { CloseSession } from "@/module/settings/component/CloseSession";
import { RecoveryLink } from "@/module/settings/component/Recovery";
import { SessionInfo } from "app/module/settings/component/SessionInfo";

export default function Settings() {
    return (
        <Grid footer={<Logout />}>
            <SessionInfo />
            <CloseSession />
            <RecoveryLink />
            <RemoveAllNotification />
        </Grid>
    );
}
