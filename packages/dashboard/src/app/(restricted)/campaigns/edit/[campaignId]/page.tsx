import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";

export default function CampaignsEditPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return (
        <CampaignEdit campaignId={params.campaignId}>
            <NewCampaign title={"Edit campaign"} />
        </CampaignEdit>
    );
}
