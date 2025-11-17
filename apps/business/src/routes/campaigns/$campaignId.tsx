import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { requireAuth } from "@/middleware/auth";
import { loadCampaignData } from "@/middleware/campaign";
import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export const Route = createFileRoute("/campaigns/$campaignId")({
    // Auth only in beforeLoad
    beforeLoad: requireAuth,
    // Data fetching in loader with caching
    loader: async ({ params }) => {
        return loadCampaignData({ params });
    },
    // Cache configuration
    staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - cache retention
    component: CampaignsContentPage,
});

function CampaignsContentPage() {
    const { campaignId } = Route.useParams();
    const campaign = Route.useLoaderData() as Campaign;

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        setCampaign({ ...campaign, id: campaignId });
        setIsFetched(true);
    }, [campaign, campaignId, setCampaign, setIsFetched]);

    return (
        <RestrictedLayout>
            <CampaignDetails campaignId={campaignId} campaign={campaign} />
        </RestrictedLayout>
    );
}
