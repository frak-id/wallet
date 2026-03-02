import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";
import { campaignQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export const Route = createFileRoute("/_restricted/campaigns/$campaignId")({
    loader: ({ params }) => {
        queryClient.prefetchQuery(
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

    const setDraft = campaignStore((state) => state.setDraft);

    useEffect(() => {
        setDraft(campaignToDraft(campaign));
    }, [campaign, setDraft]);

    return <CampaignDetails campaignId={campaignId} campaign={campaign} />;
}
