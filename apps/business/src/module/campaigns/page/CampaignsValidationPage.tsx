import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";

export function CampaignsValidationPage() {
    return (
        <CampaignCreate>
            <ValidationCampaign />
        </CampaignCreate>
    );
}
