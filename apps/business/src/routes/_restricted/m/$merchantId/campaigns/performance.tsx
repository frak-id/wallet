import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "@/config/auth";
import { TableCampaignPerformance } from "@/module/campaigns/component/TableCampaignPerformance";
import { campaignsStatsQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/performance"
)({
    loader: ({ params }) => {
        queryClient.prefetchQuery(
            campaignsStatsQueryOptions({
                merchantId: params.merchantId,
                isDemoMode: isDemoMode(),
            })
        );
    },
    component: CampaignsPerformancePage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="campaign performance data" />
    ),
});

function CampaignsPerformancePage() {
    const { t } = useTranslation();
    return (
        <>
            <Head
                title={{ content: t("shell.nav.campaigns") }}
                leftSection={
                    <Breadcrumb current={t("shell.nav.campaignsOverview")} />
                }
            />
            <TableCampaignPerformance />
        </>
    );
}
