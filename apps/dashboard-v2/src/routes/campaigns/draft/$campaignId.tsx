import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/draft/$campaignId")({
    beforeLoad: requireAuth,
    component: CampaignsDraftPage,
});

function CampaignsDraftPage() {
    const { campaignId } = Route.useParams();
    return (
        <RestrictedLayout>
            <CampaignLoad campaignId={campaignId}>
                <NewCampaign title={"Edit campaign"} />
            </CampaignLoad>
        </RestrictedLayout>
    );
}
