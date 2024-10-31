import { Grid } from "@/module/common/component/Grid";
import { History } from "@/module/history/component/History";
import { RestrictedLayout } from "@/module/layout/RestrictedLayout";

export default function HistoryRoute() {
    return (
        <RestrictedLayout>
            <Grid>
                <History />
            </Grid>
        </RestrictedLayout>
    );
}
