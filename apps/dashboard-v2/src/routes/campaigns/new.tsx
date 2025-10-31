import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { CampaignCreate } from "@/module/campaigns/component/CampaignCreate";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/new")({
    beforeLoad: requireAuth,
    component: CampaignsNewPage,
});

function CampaignsNewPage() {
    return (
        <RestrictedLayout>
            <CampaignCreate>
                <NewCampaign title={"Create a new campaign"} />
            </CampaignCreate>
        </RestrictedLayout>
    );
}
