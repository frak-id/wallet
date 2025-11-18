import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { TableCampaignPerformance } from "@/module/campaigns/component/TableCampaignPerformance";
import { campaignsStatsQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { queryClient } from "@/module/common/provider/RootProvider";

export const Route = createFileRoute("/campaigns/performance")({
    beforeLoad: requireAuth,
    loader: () => {
        return queryClient.ensureQueryData(campaignsStatsQueryOptions());
    },
    component: CampaignsPerformancePage,
    pendingComponent: () => (
        <RestrictedLayout>
            <Spinner />
        </RestrictedLayout>
    ),
});

function CampaignsPerformancePage() {
    return (
        <RestrictedLayout>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb current={"Campaign List"} />}
                rightSection={<ButtonNewCampaign />}
            />
            <TableCampaignPerformance />
        </RestrictedLayout>
    );
}
