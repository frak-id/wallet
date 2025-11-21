import { createFileRoute } from "@tanstack/react-router";
import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RouteError } from "@/module/common/component/RouteError";

export const Route = createFileRoute("/_restricted/campaigns/new")({
    component: CampaignsNewPage,
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Failed to Create Campaign"
            fallbackPath="/campaigns/list"
            fallbackLabel="Back to Campaigns"
        />
    ),
});

function CampaignsNewPage() {
    return (
        <CampaignCreate>
            <NewCampaign title={"Create a new campaign"} />
        </CampaignCreate>
    );
}
