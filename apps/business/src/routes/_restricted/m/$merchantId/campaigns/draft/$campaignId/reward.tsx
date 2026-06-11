import { createFileRoute } from "@tanstack/react-router";
import { RewardCampaign } from "@/module/campaigns/component/Creation/RewardCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId/reward"
)({
    staticData: { shell: "bare" },
    loader: draftCampaignLoader,
    component: CampaignsDraftRewardPage,
    errorComponent: CampaignError,
});

function CampaignsDraftRewardPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <RewardCampaign />;
}
