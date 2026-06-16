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
import { useMerchant } from "@/module/merchant/hook/useMerchant";
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

    const { data: merchant } = useMerchant({ merchantId });
    const defaultRewardToken = merchant?.defaultRewardToken;
    const setDraft = campaignStore((state) => state.setDraft);
    const draftId = campaignStore((state) => state.draft.id);

    useEffect(() => {
        // Wait for the merchant default so a stored token equal to it can be
        // recognised as "use default" rather than an explicit currency.
        if (!defaultRewardToken) return;
        if (draftId !== campaignId) {
            setDraft(campaignToDraft(campaign, defaultRewardToken));
        }
    }, [campaign, campaignId, draftId, setDraft, defaultRewardToken]);
}
