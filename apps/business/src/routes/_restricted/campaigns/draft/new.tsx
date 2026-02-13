import { createFileRoute } from "@tanstack/react-router";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RouteError } from "@/module/common/component/RouteError";

export const Route = createFileRoute("/_restricted/campaigns/draft/new")({
    component: CampaignsDraftNewPage,
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Failed to Create Campaign"
            fallbackPath="/campaigns/list"
            fallbackLabel="Back to Campaigns"
        />
    ),
});

function CampaignsDraftNewPage() {
    return <NewCampaign title="Create a new campaign" />;
}
