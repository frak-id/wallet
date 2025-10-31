import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/metrics")({
    beforeLoad: requireAuth,
    component: CampaignsMetricsPage,
});

function CampaignsMetricsPage() {
    return (
        <RestrictedLayout>
            <CampaignCreate>
                <MetricsCampaign />
            </CampaignCreate>
        </RestrictedLayout>
    );
}
