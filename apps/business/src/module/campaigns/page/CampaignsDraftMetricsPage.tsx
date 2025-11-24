import { useEffect } from "react";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";
import { Route } from "@/routes/_restricted/campaigns/draft/$campaignId/metrics";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export function CampaignsDraftMetricsPage() {
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

    return <MetricsCampaign />;
}
