import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { RemoveAllNotification } from "@/module/notification/component/RemoveAllNotification";
import { BiometryInfo } from "@/module/settings/component/BiometryInfo";
import { CloseSession } from "@/module/settings/component/CloseSession";
import { RecoveryLink } from "@/module/settings/component/Recovery";

export default function Settings() {
    return (
        <Grid footer={<Logout />}>
            <BiometryInfo />
            <CloseSession />
            <RecoveryLink />
            <RemoveAllNotification />
        </Grid>
    );
}
