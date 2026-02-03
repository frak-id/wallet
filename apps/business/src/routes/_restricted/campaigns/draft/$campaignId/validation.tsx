import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
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
    loader: ({ params }) => {
        queryClient.prefetchQuery(
            campaignQueryOptions(
                params.campaignId,
                false,
                "",
                validateDraftCampaign(params.campaignId)
            )
        );
    },
    component: CampaignsDraftValidationPage,
});

function CampaignsDraftValidationPage() {
    const { campaignId } = Route.useParams();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions(
            campaignId,
            false,
            "",
            validateDraftCampaign(campaignId)
        )
    );

    const setDraft = campaignStore((state) => state.setDraft);
    const draftId = campaignStore((state) => state.draft.id);

    useEffect(() => {
        if (draftId !== campaignId) {
            setDraft(campaignToDraft(campaign));
        }
    }, [campaign, campaignId, draftId, setDraft]);

    return <ValidationCampaign />;
}
