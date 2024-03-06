import { GetFrk } from "@/module/authentication/component/GetFrk";
import { Logout } from "@/module/authentication/component/Logout";
import { SwitchTheme } from "@/module/authentication/component/SwitchTheme";
import { Grid } from "@/module/common/component/Grid";
import { Settings } from "@/module/wallet/component/Settings";

export default async function SettingsPage() {
    return (
        <Grid
            footer={
                <>
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
