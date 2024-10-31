import { Grid } from "@/module/common/component/Grid";
import { RestrictedLayout } from "@/module/layout/RestrictedLayout";
import { SetupRecovery } from "@/module/recovery-setup/component/Setup";

export default function SettingsRecoveryRoute() {
    return (
        <RestrictedLayout>
            <Grid>
                <SetupRecovery />
            </Grid>
        </RestrictedLayout>
    );
}