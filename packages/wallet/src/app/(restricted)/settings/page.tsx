import { GetFrk } from "@/module/authentication/component/GetFrk";
import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { Settings } from "@/module/settings/component/Settings";

export default async function SettingsPage() {
    return (
        <Grid
            footer={
                <>
                    <GetFrk />
                    <Logout />
                </>
            }
        >
            <Settings />
        </Grid>
    );
}
