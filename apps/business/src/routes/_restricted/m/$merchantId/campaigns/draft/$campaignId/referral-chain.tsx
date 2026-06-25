import { createFileRoute } from "@tanstack/react-router";
import { ReferralChainCampaign } from "@/module/campaigns/component/Creation/ReferralChainCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId/referral-chain"
)({
    staticData: { shell: "bare" },
    loader: draftCampaignLoader,
    component: CampaignsDraftReferralChainPage,
    errorComponent: CampaignError,
});

function CampaignsDraftReferralChainPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <ReferralChainCampaign />;
}
