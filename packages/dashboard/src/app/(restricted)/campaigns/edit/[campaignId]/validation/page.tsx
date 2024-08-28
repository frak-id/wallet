import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";

export default function CampaignsEditValidationPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return (
        <CampaignEdit campaignId={params.campaignId}>
            <ValidationCampaign />
        </CampaignEdit>
    );
}
