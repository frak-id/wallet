import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { PageShell } from "@/module/common/component/PageShell";
import { CriticalError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MyMerchants } from "@/module/dashboard/component/Products";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/m/$merchantId/dashboard")({
    loader: () => {
        queryClient.prefetchQuery(myMerchantsQueryOptions(isDemoMode()));
    },
    component: Dashboard,
    errorComponent: CriticalError,
});

function Dashboard() {
    return (
        <PageShell page="dashboard">
            <MyMerchants />
        </PageShell>
    );
}
