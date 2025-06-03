import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";

export default function CampaignsNewPage() {
    return (
        <CampaignCreate>
            <NewCampaign title={"Create a new campaign"} />
        </CampaignCreate>
    );
}
