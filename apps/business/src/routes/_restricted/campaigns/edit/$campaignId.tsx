import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/context/auth/authEnv";
import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import {
    campaignQueryOptions,
    validateEditCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { mapCampaignToFormData } from "@/module/campaigns/utils/mapper";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore } from "@/stores/campaignStore";

export const Route = createFileRoute("/_restricted/campaigns/edit/$campaignId")(
    {
        loader: ({ params }) => {
            return queryClient.ensureQueryData(
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

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setAction = campaignStore((state) => state.setAction);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        const formData = mapCampaignToFormData(campaign);
        setCampaign(formData);
        setAction("edit");
        setIsFetched(true);
    }, [campaign, setAction, setIsFetched, setCampaign]);

    return <CampaignEdit campaignId={campaignId} />;
}
