import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { Settings } from "@/module/settings/component/Settings";
import { SwitchTheme } from "@/module/settings/component/SwitchTheme";

export default async function SettingsPage() {
    return (
        <Grid
            footer={
                <>
                    <SwitchTheme />
                    <Logout />
                </>
            }
        >
            <Settings />
        </Grid>
    );
}
