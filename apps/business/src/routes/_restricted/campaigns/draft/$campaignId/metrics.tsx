import { createFileRoute } from "@tanstack/react-router";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/metrics"
)({
    loader: draftCampaignLoader,
    component: CampaignsDraftMetricsPage,
});

function CampaignsDraftMetricsPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <MetricsCampaign />;
}
