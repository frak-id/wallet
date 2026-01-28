import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/context/auth/authEnv";
import { MetricsCampaign } from "@/module/campaigns/component/Creation/MetricsCampaign";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { mapCampaignToFormData } from "@/module/campaigns/utils/mapper";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/metrics"
)({
    // Prefetch into TanStack Query cache with validation
    loader: ({ params }) => {
        return queryClient.ensureQueryData(
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
    const campaign = Route.useLoaderData() as Campaign;

    // Use individual selectors to avoid infinite loop
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setAction = campaignStore((state) => state.setAction);
    const setIsFetched = campaignStore((state) => state.setIsFetched);

    // Set campaign in store on mount (maintaining existing behavior from CampaignLoad)
    useEffect(() => {
        const formData = mapCampaignToFormData(campaign);
        setCampaign(formData);
        setAction("draft");
        setIsFetched(true);
    }, [campaign, campaignId, setCampaign, setAction, setIsFetched]);

    return <MetricsCampaign />;
}
