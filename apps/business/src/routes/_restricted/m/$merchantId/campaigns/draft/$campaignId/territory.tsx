import { createFileRoute } from "@tanstack/react-router";
import { TerritoryCampaign } from "@/module/campaigns/component/Creation/TerritoryCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId/territory"
)({
    staticData: { shell: "bare" },
    loader: draftCampaignLoader,
    component: CampaignsDraftTerritoryPage,
    errorComponent: CampaignError,
});

function CampaignsDraftTerritoryPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <TerritoryCampaign />;
}
