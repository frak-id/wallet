import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore } from "@/stores/campaignStore";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId"
)({
    // Prefetch into TanStack Query cache with validation
    loader: ({ params }) => {
        return queryClient.ensureQueryData(
            campaignQueryOptions(
                params.campaignId,
                validateDraftCampaign(params.campaignId)
            )
        );
    },
    component: CampaignsDraftPage,
    errorComponent: CampaignError,
});

function CampaignsDraftPage() {
    const { campaignId } = Route.useParams();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions(campaignId, validateDraftCampaign(campaignId))
    );

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setAction = campaignStore((state) => state.setAction);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        setCampaign({ ...campaign, id: campaignId });
        setAction("draft");
        setIsFetched(true);
    }, [campaign, campaignId, setCampaign, setAction, setIsFetched]);

    return <NewCampaign title={"Edit campaign"} />;
}
