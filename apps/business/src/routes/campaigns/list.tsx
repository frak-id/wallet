import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { TableCampaigns } from "@/module/campaigns/component/TableCampaigns";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { queryClient } from "@/module/common/provider/RootProvider";
import { demoModeStore } from "@/stores/demoModeStore";

export const Route = createFileRoute("/campaigns/list")({
    beforeLoad: requireAuth,
    loader: () => {
        const isDemoMode = demoModeStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            campaignsListQueryOptions(isDemoMode)
        );
    },
    component: CampaignsListPage,
    pendingComponent: () => (
        <RestrictedLayout>
            <Skeleton />
        </RestrictedLayout>
    ),
});

function CampaignsListPage() {
    return (
        <RestrictedLayout>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb current={"Campaign List"} />}
                rightSection={<ButtonNewCampaign />}
            />
            <TableCampaigns />
        </RestrictedLayout>
    );
}
