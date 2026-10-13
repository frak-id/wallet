import { createFileRoute } from "@tanstack/react-router";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId/"
)({
    staticData: { shell: "bare" },
    loader: draftCampaignLoader,
    component: CampaignsDraftPage,
});

function CampaignsDraftPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <NewCampaign />;
}
