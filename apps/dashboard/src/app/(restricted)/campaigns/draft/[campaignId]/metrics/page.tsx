import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";

export default async function CampaignsDraftMetricsPage(props: {
    params: Promise<{ campaignId: string }>;
}) {
    const params = await props.params;
    return (
        <CampaignLoad campaignId={params.campaignId}>
            <MetricsCampaign />
        </CampaignLoad>
    );
}
