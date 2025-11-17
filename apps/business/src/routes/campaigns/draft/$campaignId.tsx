import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { requireAuth } from "@/middleware/auth";
import { loadCampaignData, validateDraftCampaign } from "@/middleware/campaign";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export const Route = createFileRoute("/campaigns/draft/$campaignId")({
    // Auth only in beforeLoad
    beforeLoad: requireAuth,
    // Data fetching + validation in loader
    loader: async ({ params }) => {
        return loadCampaignData({
            params,
            validateState: validateDraftCampaign(params.campaignId),
        });
    },
    // Cache configuration
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    component: CampaignsDraftPage,
});

function CampaignsDraftPage() {
    const { campaignId } = Route.useParams();
    const campaign = Route.useLoaderData() as Campaign;

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
