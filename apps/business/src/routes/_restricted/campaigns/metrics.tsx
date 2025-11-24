import { createFileRoute } from "@tanstack/react-router";
import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";
import { DataLoadError } from "@/module/common/component/RouteError";

export const Route = createFileRoute("/_restricted/campaigns/metrics")({
    component: CampaignsMetricsPage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="campaign metrics" />
    ),
});

function CampaignsMetricsPage() {
    return (
        <CampaignCreate>
            <MetricsCampaign />
        </CampaignCreate>
    );
}
