import { createFileRoute } from "@tanstack/react-router";
import { ProductsCampaign } from "@/module/campaigns/component/Creation/ProductsCampaign";
import {
    draftCampaignLoader,
    useCampaignDraftSync,
} from "@/module/campaigns/hook/useCampaignDraftSync";
import { CampaignError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/$campaignId/products"
)({
    staticData: { shell: "bare" },
    loader: draftCampaignLoader,
    component: CampaignsDraftProductsPage,
    errorComponent: CampaignError,
});

function CampaignsDraftProductsPage() {
    const { campaignId } = Route.useParams();
    useCampaignDraftSync(campaignId);
    return <ProductsCampaign />;
}
