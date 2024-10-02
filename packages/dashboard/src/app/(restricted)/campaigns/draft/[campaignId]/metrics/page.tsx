import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";

export default function CampaignsDraftMetricsPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return (
        <CampaignLoad campaignId={params.campaignId} campaignAction={"draft"}>
            <MetricsCampaign />
        </CampaignLoad>
    );
}
