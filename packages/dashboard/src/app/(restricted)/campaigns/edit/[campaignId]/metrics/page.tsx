import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";

export default function CampaignsEditMetricsPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return (
        <CampaignEdit campaignId={params.campaignId}>
            <MetricsCampaign />
        </CampaignEdit>
    );
}
