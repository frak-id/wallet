import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { Settings } from "@/module/settings/component/Settings";

export default function SettingsRoute() {
    return (
        <Grid footer={<Logout />}>
            <Settings />
        </Grid>
    );
}
