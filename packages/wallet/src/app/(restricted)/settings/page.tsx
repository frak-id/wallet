import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { GetFrk } from "@/module/settings/component/GetFrk";
import { ProfileEdit } from "@/module/settings/component/ProfileEdit";
import { Settings } from "@/module/settings/component/Settings";
import { SwitchTheme } from "@/module/settings/component/SwitchTheme";

export default async function SettingsPage() {
    return (
        <Grid
            footer={
                <>
                    <ProfileEdit />
                    <SwitchTheme />
                    <GetFrk />
                    <Logout />
                </>
            }
        >
            <Settings />
        </Grid>
    );
}
