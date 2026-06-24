import { useSuspenseQuery } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import { campaignQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { queryClient } from "@/module/common/provider/RootProvider";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export async function draftCampaignLoader({
    params,
}: {
    params: { merchantId: string; campaignId: string };
}) {
    // Guard in the loader so redirects fire inside the router lifecycle,
    // not from a queryFn rethrown during render by useSuspenseQuery.
    const campaign = await queryClient.ensureQueryData(
        campaignQueryOptions({
            merchantId: params.merchantId,
            campaignId: params.campaignId,
            isDemoMode: isDemoMode(),
        })
    );

    // Only drafts are editable; send everything else back to the list.
    if (!campaign || campaign.status !== "draft") {
        throw redirect({
            to: "/m/$merchantId/campaigns/list",
            params: { merchantId: params.merchantId },
        });
    }
}

export function useCampaignDraftSync(campaignId: string) {
    const isDemo = useIsDemoMode();
    const merchantId = useActiveMerchantId();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions({
            merchantId,
            campaignId,
            isDemoMode: isDemo,
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
        // A background refetch could resolve to a since-published campaign;
        // never sync that into the draft store.
        if (!campaign || campaign.status !== "draft") return;
        if (draftId !== campaignId) {
            setDraft(campaignToDraft(campaign, defaultRewardToken));
        }
    }, [campaign, campaignId, draftId, setDraft, defaultRewardToken]);
}
