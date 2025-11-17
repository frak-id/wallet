import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export default function CampaignsValidationPage() {
    return (
        <RestrictedLayout>
            <CampaignCreate>
                <ValidationCampaign />
            </CampaignCreate>
        </RestrictedLayout>
    );
}
