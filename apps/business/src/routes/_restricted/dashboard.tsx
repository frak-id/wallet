import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { CriticalError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MyMerchants } from "@/module/dashboard/component/Products";
import { myMerchantsQueryOptions } from "@/module/dashboard/queries/queryOptions";

export const Route = createFileRoute("/_restricted/dashboard")({
    loader: () => {
        return queryClient.ensureQueryData(
            myMerchantsQueryOptions(isDemoMode())
        );
    },
    component: Dashboard,
    errorComponent: CriticalError,
});

function Dashboard() {
    return (
        <>
            <Head
                title={{ content: "Dashboard" }}
                leftSection={<Breadcrumb current={"Home"} />}
            />
            <MyMerchants />
        </>
    );
}
