import { createFileRoute } from "@tanstack/react-router";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/validation"
)({
    loader: draftCampaignLoader,
    component: CampaignsDraftValidationPage,
});

function CampaignsDraftValidationPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <ValidationCampaign />;
}
