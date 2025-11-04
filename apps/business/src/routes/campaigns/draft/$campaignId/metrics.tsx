import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/draft/$campaignId/metrics")({
    beforeLoad: requireAuth,
    component: CampaignsDraftMetricsPage,
});

function CampaignsDraftMetricsPage() {
    const { campaignId } = Route.useParams();
    return (
        <RestrictedLayout>
            <CampaignLoad campaignId={campaignId}>
                <MetricsCampaign />
            </CampaignLoad>
        </RestrictedLayout>
    );
}
