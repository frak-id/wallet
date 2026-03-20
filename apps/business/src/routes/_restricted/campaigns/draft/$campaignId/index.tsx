import { createFileRoute } from "@tanstack/react-router";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/"
)({
    loader: draftCampaignLoader,
    component: CampaignsDraftPage,
    errorComponent: CampaignError,
});

function CampaignsDraftPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <NewCampaign title="Edit campaign" />;
}
