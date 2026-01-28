import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/context/auth/authEnv";
import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";
import { campaignQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { mapCampaignToFormData } from "@/module/campaigns/utils/mapper";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore } from "@/stores/campaignStore";

export const Route = createFileRoute("/_restricted/campaigns/$campaignId")({
    loader: ({ params }) => {
        return queryClient.ensureQueryData(
            campaignQueryOptions(params.campaignId, isDemoMode())
        );
    },
    component: CampaignsContentPage,
    errorComponent: CampaignError,
});

function CampaignsContentPage() {
    const { campaignId } = Route.useParams();
    const isDemo = useIsDemoMode();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions(campaignId, isDemo)
    );

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        const formData = mapCampaignToFormData(campaign);
        setCampaign(formData);
        setIsFetched(true);
    }, [campaign, setCampaign, setIsFetched]);

    return <CampaignDetails campaignId={campaignId} campaign={campaign} />;
}
