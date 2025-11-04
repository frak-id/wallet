import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/$campaignId")({
    beforeLoad: requireAuth,
    component: CampaignsContentPage,
});

function CampaignsContentPage() {
    const { campaignId } = Route.useParams();
    return (
        <RestrictedLayout>
            <CampaignDetails campaignId={campaignId} />
        </RestrictedLayout>
    );
}
