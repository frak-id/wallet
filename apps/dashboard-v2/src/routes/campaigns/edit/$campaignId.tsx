import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/edit/$campaignId")({
    beforeLoad: requireAuth,
    component: CampaignsEditPage,
});

function CampaignsEditPage() {
    const { campaignId } = Route.useParams();
    return (
        <RestrictedLayout>
            <CampaignLoad campaignId={campaignId}>
                <CampaignEdit />
            </CampaignLoad>
        </RestrictedLayout>
    );
}
