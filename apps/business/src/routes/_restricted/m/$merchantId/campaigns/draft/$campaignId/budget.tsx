import { createFileRoute } from "@tanstack/react-router";
import { BudgetCampaign } from "@/module/campaigns/component/Creation/BudgetCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId/budget"
)({
    staticData: { shell: "bare" },
    loader: draftCampaignLoader,
    component: CampaignsDraftBudgetPage,
    errorComponent: CampaignError,
});

function CampaignsDraftBudgetPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <BudgetCampaign />;
}
