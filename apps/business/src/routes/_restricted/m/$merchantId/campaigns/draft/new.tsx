import { createFileRoute } from "@tanstack/react-router";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { CampaignCreateError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/new"
)({
    staticData: { shell: "bare" },
    component: CampaignsDraftNewPage,
    errorComponent: CampaignCreateError,
});

function CampaignsDraftNewPage() {
    return <NewCampaign />;
}
