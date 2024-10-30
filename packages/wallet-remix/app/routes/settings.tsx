import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { RestrictedLayout } from "@/module/layout/RestrictedLayout";
import { Settings } from "@/module/settings/component/Settings";

export default function SettingsRoute() {
    return (
        <RestrictedLayout>
            <Grid footer={<Logout />}>
                <Settings />
            </Grid>
        </RestrictedLayout>
    );
}
