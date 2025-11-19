import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { TableCampaigns } from "@/module/campaigns/component/TableCampaigns";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_restricted/campaigns/list")({
    loader: () => {
        const isDemoMode = useAuthStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            campaignsListQueryOptions(isDemoMode)
        );
    },
    component: CampaignsListPage,
    pendingComponent: () => <Skeleton />,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="campaigns" />
    ),
});

function CampaignsListPage() {
    return (
        <>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb current={"Campaign List"} />}
                rightSection={<ButtonNewCampaign />}
            />
            <TableCampaigns />
        </>
    );
}
