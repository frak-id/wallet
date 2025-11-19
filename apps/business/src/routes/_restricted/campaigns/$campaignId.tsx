import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";
import { campaignQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore } from "@/stores/campaignStore";

export const Route = createFileRoute("/_restricted/campaigns/$campaignId")({
    // Prefetch into TanStack Query cache
    loader: ({ params }) => {
        return queryClient.ensureQueryData(
            campaignQueryOptions(params.campaignId)
        );
    },
    component: CampaignsContentPage,
    pendingComponent: () => <Skeleton />,
    errorComponent: CampaignError,
});

function CampaignsContentPage() {
    const { campaignId } = Route.useParams();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions(campaignId)
    );

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        setCampaign({ ...campaign, id: campaignId });
        setIsFetched(true);
    }, [campaign, campaignId, setCampaign, setIsFetched]);

    return <CampaignDetails campaignId={campaignId} campaign={campaign} />;
}
