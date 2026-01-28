import { createFileRoute } from "@tanstack/react-router";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/"
)({
    loader: async ({ params }) => {
        const storeDraftId = campaignStore.getState().draft.id;
        if (storeDraftId === params.campaignId) {
            return null;
        }
        const campaign = await queryClient.ensureQueryData(
            campaignQueryOptions(
                params.campaignId,
                false,
                "",
                validateDraftCampaign(params.campaignId)
            )
        );
        campaignStore.getState().setDraft(campaignToDraft(campaign));
        return campaign;
    },
    component: CampaignsDraftPage,
    errorComponent: CampaignError,
});

function CampaignsDraftPage() {
    return <NewCampaign title="Edit campaign" />;
}
