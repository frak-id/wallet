import { Grid } from "@/module/common/component/Grid";
import { NotificationHistory } from "@/module/history/component/NotificationHistory";
import { RestrictedLayout } from "@/module/layout/RestrictedLayout";

export default function NotificationsRoute() {
    return (
        <RestrictedLayout>
            <Grid>
                <NotificationHistory />
            </Grid>
        </RestrictedLayout>
    );
}
