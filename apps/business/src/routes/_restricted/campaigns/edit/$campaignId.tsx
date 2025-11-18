import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import {
    campaignQueryOptions,
    validateEditCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore } from "@/stores/campaignStore";

export const Route = createFileRoute("/_restricted/campaigns/edit/$campaignId")(
    {
        // Prefetch into TanStack Query cache with validation
        loader: ({ params }) => {
            return queryClient.ensureQueryData(
                campaignQueryOptions(
                    params.campaignId,
                    validateEditCampaign(params.campaignId)
                )
            );
        },
        component: CampaignsEditPage,
        pendingComponent: () => <Skeleton />,
    }
);

function CampaignsEditPage() {
    const { campaignId } = Route.useParams();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions(campaignId, validateEditCampaign(campaignId))
    );

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setAction = campaignStore((state) => state.setAction);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        setCampaign({ ...campaign, id: campaignId });
        setAction("edit");
        setIsFetched(true);
    }, [campaign, campaignId, setCampaign, setAction, setIsFetched]);

    return <CampaignEdit />;
}
