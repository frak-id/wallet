import { Logout } from "@/module/authentication/component/Logout";
import { Grid } from "@/module/common/component/Grid";
import { Settings } from "@/module/settings/component/Settings";
import { SwitchTheme } from "@/module/settings/component/SwitchTheme";
import Link from "next/link";

export default async function SettingsPage() {
    return (
        <Grid
            footer={
                <>
                    <Link href="/notification">Notification</Link>
                    <SwitchTheme />
                    <Logout />
                </>
            }
        >
            <Settings />
        </Grid>
    );
}
