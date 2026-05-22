import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import {
    campaignQueryOptions,
    validateDraftCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export function draftCampaignLoader({
    params,
}: {
    params: { merchantId: string; campaignId: string };
}) {
    queryClient.prefetchQuery(
        campaignQueryOptions({
            merchantId: params.merchantId,
            campaignId: params.campaignId,
            isDemoMode: isDemoMode(),
            validateState: validateDraftCampaign(
                params.merchantId,
                params.campaignId
            ),
        })
    );
}

export function useCampaignDraftSync(campaignId: string) {
    const isDemo = useIsDemoMode();
    const merchantId = useActiveMerchantId();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions({
            merchantId,
            campaignId,
            isDemoMode: isDemo,
            validateState: validateDraftCampaign(merchantId, campaignId),
        })
    );

    const setDraft = campaignStore((state) => state.setDraft);
    const draftId = campaignStore((state) => state.draft.id);

    useEffect(() => {
        if (draftId !== campaignId) {
            setDraft(campaignToDraft(campaign));
        }
    }, [campaign, campaignId, draftId, setDraft]);
}
