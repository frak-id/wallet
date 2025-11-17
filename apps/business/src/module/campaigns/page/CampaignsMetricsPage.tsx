import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export default function CampaignsMetricsPage() {
    return (
        <RestrictedLayout>
            <CampaignCreate>
                <MetricsCampaign />
            </CampaignCreate>
        </RestrictedLayout>
    );
}
