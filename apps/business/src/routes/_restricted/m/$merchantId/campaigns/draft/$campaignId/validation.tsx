import { createFileRoute } from "@tanstack/react-router";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId/validation"
)({
    staticData: { shell: "bare" },
    loader: draftCampaignLoader,
    component: CampaignsDraftValidationPage,
    errorComponent: CampaignError,
});

function CampaignsDraftValidationPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <ValidationCampaign />;
}
