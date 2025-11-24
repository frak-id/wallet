import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";

export function CampaignsMetricsPage() {
    return (
        <CampaignCreate>
            <MetricsCampaign />
        </CampaignCreate>
    );
}
