import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { loadCampaign } from "@/middleware/campaign";
import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export const Route = createFileRoute("/campaigns/$campaignId")({
    beforeLoad: async ({ params, location }) => {
        return loadCampaign({ params, location });
    },
    component: CampaignsContentPage,
});

function CampaignsContentPage() {
    const { campaignId } = Route.useParams();
    const routeContext = Route.useRouteContext();
    const { campaign } = routeContext as { campaign: Campaign };

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        setCampaign({ ...campaign, id: campaignId } as Campaign);
        setIsFetched(true);
    }, [campaign, campaignId, setCampaign, setIsFetched]);

    return (
        <RestrictedLayout>
            <CampaignDetails campaignId={campaignId} campaign={campaign} />
        </RestrictedLayout>
    );
}
