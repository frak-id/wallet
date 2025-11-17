import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export default function CampaignsNewPage() {
    return (
        <RestrictedLayout>
            <CampaignCreate>
                <NewCampaign title={"Create a new campaign"} />
            </CampaignCreate>
        </RestrictedLayout>
    );
}
