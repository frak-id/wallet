import { createFileRoute } from "@tanstack/react-router";
import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";

export const Route = createFileRoute("/_restricted/campaigns/validation")({
    component: CampaignsValidationPage,
});

function CampaignsValidationPage() {
    return (
        <CampaignCreate>
            <ValidationCampaign />
        </CampaignCreate>
    );
}
