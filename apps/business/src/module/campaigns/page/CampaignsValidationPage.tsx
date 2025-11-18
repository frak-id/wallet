import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";

export default function CampaignsValidationPage() {
    return (
        <CampaignCreate>
            <ValidationCampaign />
        </CampaignCreate>
    );
}
