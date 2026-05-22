import { createFileRoute } from "@tanstack/react-router";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RouteError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/new"
)({
    component: CampaignsDraftNewPage,
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Failed to Create Campaign"
            fallbackPath="/dashboard"
            fallbackLabel="Back to Dashboard"
        />
    ),
});

function CampaignsDraftNewPage() {
    return <NewCampaign title="Create a new campaign" />;
}
