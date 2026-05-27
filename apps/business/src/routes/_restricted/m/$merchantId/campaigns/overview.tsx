import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { TableCampaignPerformance } from "@/module/campaigns/component/TableCampaignPerformance";
import { campaignsStatsQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { PageShell } from "@/module/common/component/PageShell";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/overview"
)({
    loader: ({ params }) => {
        queryClient.prefetchQuery(
            campaignsStatsQueryOptions({
                merchantId: params.merchantId,
                isDemoMode: isDemoMode(),
            })
        );
    },
    component: CampaignsOverviewPage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="campaign overview data" />
    ),
});

function CampaignsOverviewPage() {
    return (
        <PageShell page="campaignsOverview">
            <TableCampaignPerformance />
        </PageShell>
    );
}
