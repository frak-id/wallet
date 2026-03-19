import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export function draftCampaignLoader({
    params,
}: {
    params: { campaignId: string };
}) {
    queryClient.prefetchQuery(
        campaignQueryOptions(
            params.campaignId,
            isDemoMode(),
            "",
            validateDraftCampaign(params.campaignId)
        )
    );
}

export function useCampaignDraftSync(campaignId: string) {
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
}
