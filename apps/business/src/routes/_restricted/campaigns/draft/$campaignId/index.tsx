import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/"
)({
    loader: ({ params }) => {
        queryClient.prefetchQuery(
            campaignQueryOptions(
                params.campaignId,
                isDemoMode(),
                "",
                validateDraftCampaign(params.campaignId)
            )
        );
    },
    component: CampaignsDraftPage,
    errorComponent: CampaignError,
});

function CampaignsDraftPage() {
    const { campaignId } = Route.useParams();
    const isDemo = useIsDemoMode();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions(
            campaignId,
            isDemo,
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

    return <NewCampaign title="Edit campaign" />;
}
