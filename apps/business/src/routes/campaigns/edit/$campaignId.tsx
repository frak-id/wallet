import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { requireAuth } from "@/middleware/auth";
import { loadCampaignData, validateEditCampaign } from "@/middleware/campaign";
import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export const Route = createFileRoute("/campaigns/edit/$campaignId")({
    // Auth only in beforeLoad
    beforeLoad: requireAuth,
    // Data fetching + validation in loader
    loader: async ({ params }) => {
        return loadCampaignData({
            params,
            validateState: validateEditCampaign(params.campaignId),
        });
    },
    // Cache configuration
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    component: CampaignsEditPage,
});

function CampaignsEditPage() {
    const { campaignId } = Route.useParams();
    const campaign = Route.useLoaderData() as Campaign;

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setAction = campaignStore((state) => state.setAction);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        setCampaign({ ...campaign, id: campaignId });
        setAction("edit");
        setIsFetched(true);
    }, [campaign, campaignId, setCampaign, setAction, setIsFetched]);

    return (
        <RestrictedLayout>
            <CampaignEdit />
        </RestrictedLayout>
    );
}
