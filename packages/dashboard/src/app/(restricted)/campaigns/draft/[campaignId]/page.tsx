import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";

export default async function CampaignsDraftPage(props: {
    params: Promise<{ campaignId: string }>;
}) {
    const params = await props.params;
    return (
        <CampaignLoad campaignId={params.campaignId}>
            <NewCampaign title={"Edit campaign"} />
        </CampaignLoad>
    );
}
