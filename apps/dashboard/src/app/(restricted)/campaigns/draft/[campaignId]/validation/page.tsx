import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";

export default async function CampaignsDraftValidationPage(props: {
    params: Promise<{ campaignId: string }>;
}) {
    const params = await props.params;
    return (
        <CampaignLoad campaignId={params.campaignId}>
            <ValidationCampaign />
        </CampaignLoad>
    );
}
