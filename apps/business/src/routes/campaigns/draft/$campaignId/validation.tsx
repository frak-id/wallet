import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { CampaignLoad } from "@/module/campaigns/component/CampaignLoad";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/draft/$campaignId/validation")(
    {
        beforeLoad: requireAuth,
        component: CampaignsDraftValidationPage,
    }
);

function CampaignsDraftValidationPage() {
    const { campaignId } = Route.useParams();
    return (
        <RestrictedLayout>
            <CampaignLoad campaignId={campaignId}>
                <ValidationCampaign />
            </CampaignLoad>
        </RestrictedLayout>
    );
}
