import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/metrics"
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
    component: CampaignsDraftMetricsPage,
});

function CampaignsDraftMetricsPage() {
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

    return <MetricsCampaign />;
}
