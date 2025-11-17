import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { loadCampaign, validateDraftCampaign } from "@/middleware/campaign";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export const Route = createFileRoute("/campaigns/draft/$campaignId")({
    beforeLoad: async ({ params, location }) => {
        return loadCampaign({
            params,
            location,
            validateState: validateDraftCampaign(params.campaignId),
        });
    },
    component: CampaignsDraftPage,
});

function CampaignsDraftPage() {
    const { campaignId } = Route.useParams();
    const routeContext = Route.useRouteContext();
    const { campaign } = routeContext as { campaign: Campaign };

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

    return (
        <RestrictedLayout>
            <NewCampaign title={"Edit campaign"} />
        </RestrictedLayout>
    );
}
