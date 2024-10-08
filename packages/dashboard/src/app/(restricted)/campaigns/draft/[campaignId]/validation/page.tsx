import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";

export default function CampaignsDraftValidationPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return (
        <CampaignLoad campaignId={params.campaignId}>
            <ValidationCampaign />
        </CampaignLoad>
    );
}
