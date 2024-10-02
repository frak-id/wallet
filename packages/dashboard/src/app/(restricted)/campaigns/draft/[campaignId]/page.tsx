import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";

export default function CampaignsDraftPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return (
        <CampaignLoad campaignId={params.campaignId} campaignAction={"draft"}>
            <NewCampaign title={"Edit campaign"} />
        </CampaignLoad>
    );
}
