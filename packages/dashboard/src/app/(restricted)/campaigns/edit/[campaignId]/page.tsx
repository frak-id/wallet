import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";

export default async function CampaignsEditPage(props: {
    params: Promise<{ campaignId: string }>;
}) {
    const params = await props.params;
    return (
        <CampaignLoad campaignId={params.campaignId}>
            <CampaignEdit />
        </CampaignLoad>
    );
}
