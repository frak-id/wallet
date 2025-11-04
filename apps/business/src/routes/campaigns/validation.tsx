import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/validation")({
    beforeLoad: requireAuth,
    component: CampaignsValidationPage,
});

function CampaignsValidationPage() {
    return (
        <RestrictedLayout>
            <CampaignCreate>
                <ValidationCampaign />
            </CampaignCreate>
        </RestrictedLayout>
    );
}
