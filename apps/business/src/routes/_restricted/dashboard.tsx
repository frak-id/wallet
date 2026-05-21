import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "@/config/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { CriticalError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MyMerchants } from "@/module/dashboard/component/Products";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/dashboard")({
    loader: () => {
        queryClient.prefetchQuery(myMerchantsQueryOptions(isDemoMode()));
    },
    component: Dashboard,
    errorComponent: CriticalError,
});

function Dashboard() {
    const { t } = useTranslation();
    return (
        <>
            <Head
                title={{ content: t("shell.nav.dashboard") }}
                leftSection={
                    <Breadcrumb current={t("shell.breadcrumb.home")} />
                }
            />
            <MyMerchants />
        </>
    );
}
