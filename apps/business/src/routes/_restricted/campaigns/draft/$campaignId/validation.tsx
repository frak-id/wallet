import { createFileRoute } from "@tanstack/react-router";
import { ValidationCampaign } from "@/module/campaigns/component/Creation/ValidationCampaign";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/validation"
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
    component: CampaignsDraftValidationPage,
});

function CampaignsDraftValidationPage() {
    return <ValidationCampaign />;
}
