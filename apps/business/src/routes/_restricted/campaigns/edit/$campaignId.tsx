import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import {
    campaignQueryOptions,
    validateEditCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export const Route = createFileRoute("/_restricted/campaigns/edit/$campaignId")(
    {
        loader: ({ params }) => {
            queryClient.prefetchQuery(
                campaignQueryOptions(
                    params.campaignId,
                    isDemoMode(),
                    undefined,
                    validateEditCampaign(params.campaignId)
                )
            );
        },
        component: CampaignsEditPage,
        errorComponent: CampaignError,
    }
);

function CampaignsEditPage() {
    const { campaignId } = Route.useParams();
    const isDemo = useIsDemoMode();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions(
            campaignId,
            isDemo,
            undefined,
            validateEditCampaign(campaignId)
        )
    );

    const setDraft = campaignStore((state) => state.setDraft);

    useEffect(() => {
        setDraft(campaignToDraft(campaign));
    }, [campaign, setDraft]);

    return <CampaignEdit campaignId={campaignId} />;
}
