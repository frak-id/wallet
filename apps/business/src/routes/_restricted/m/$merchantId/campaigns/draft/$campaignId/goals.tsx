import { createFileRoute } from "@tanstack/react-router";
import { GoalsCampaign } from "@/module/campaigns/component/Creation/GoalsCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId/goals"
)({
    staticData: { shell: "bare" },
    loader: draftCampaignLoader,
    component: CampaignsDraftGoalsPage,
    errorComponent: CampaignError,
});

function CampaignsDraftGoalsPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <GoalsCampaign />;
}
