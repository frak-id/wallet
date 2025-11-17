import { useEffect } from "react";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { Route } from "@/routes/campaigns/draft/$campaignId/validation";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export default function CampaignsDraftValidationPage() {
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
            <ValidationCampaign />
        </RestrictedLayout>
    );
}
