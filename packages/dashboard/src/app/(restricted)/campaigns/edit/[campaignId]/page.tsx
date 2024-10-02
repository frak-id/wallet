import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";

export default function CampaignsEditPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return (
        <CampaignLoad campaignId={params.campaignId}>
            <CampaignEdit />
        </CampaignLoad>
    );
}
