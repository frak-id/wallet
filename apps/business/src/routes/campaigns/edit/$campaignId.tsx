import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { loadCampaign, validateEditCampaign } from "@/middleware/campaign";
import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export const Route = createFileRoute("/campaigns/edit/$campaignId")({
    beforeLoad: async ({ params, location }) => {
        return loadCampaign({
            params,
            location,
            validateState: validateEditCampaign(params.campaignId),
        });
    },
    component: CampaignsEditPage,
});

function CampaignsEditPage() {
    const { campaignId } = Route.useParams();
    const routeContext = Route.useRouteContext();
    const { campaign } = routeContext as { campaign: Campaign };

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setAction = campaignStore((state) => state.setAction);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        setCampaign({ ...campaign, id: campaignId } as Campaign);
        setAction("edit");
        setIsFetched(true);
    }, [campaign, campaignId, setCampaign, setAction, setIsFetched]);

    return (
        <RestrictedLayout>
            <CampaignEdit />
        </RestrictedLayout>
    );
}
