import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createCampaign,
    updateCampaign,
} from "@/module/campaigns/api/campaignApi";
import { campaignsQueryKey } from "@/module/campaigns/queries/queryKeys";
import { campaignQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import {
    buildApiPayload,
    type CampaignDraft,
    campaignStore,
} from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

function buildDemoCampaign(draft: CampaignDraft): Campaign {
    return {
        id: draft.id ?? crypto.randomUUID(),
        merchantId: draft.merchantId,
        name: draft.name,
        status: "draft",
        createdAt: new Date().toISOString(),
        publishedAt: null,
        rule: draft.rule,
        metadata: draft.metadata,
        budgetConfig: draft.budgetConfig,
        budgetUsed: null,
        expiresAt: draft.expiresAt ?? null,
        priority: draft.priority,
    } as Campaign;
}

export function useSaveCampaign() {
    const queryClient = useQueryClient();
    const isDemoMode = useIsDemoMode();

    return useMutation({
        mutationKey: ["campaigns", "save"],
        mutationFn: async (draft: CampaignDraft): Promise<Campaign> => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                const demoCampaign = buildDemoCampaign(draft);
                campaignStore
                    .getState()
                    .setDraft({ ...draft, id: demoCampaign.id });
                return demoCampaign;
            }

            const payload = buildApiPayload(draft);
            if (draft.id) {
                // `rule` carries every wizard step before the reward one,
                // so it must go out on each save.
                const updated = await updateCampaign({
                    campaignId: draft.id,
                    ...payload,
                });
                campaignStore.getState().setDraft(draft);
                return updated;
            }
            const created = await createCampaign(payload);
            // Keep the submitted draft: it carries the UI-only `rewardToken`,
            // which the response cannot supply before any reward exists.
            campaignStore.getState().setDraft({ ...draft, id: created.id });
            return created;
        },
        onSuccess: async (campaign, draft) => {
            // Seed the detail query so the next step's useSuspenseQuery finds
            // the campaign in cache and doesn't suspend (the step 1 → 2
            // transition otherwise swaps the whole page for a fallback).
            queryClient.setQueryData(
                campaignQueryOptions({
                    merchantId: draft.merchantId,
                    campaignId: campaign.id,
                    isDemoMode,
                }).queryKey,
                campaign
            );
            await queryClient.invalidateQueries({
                queryKey: campaignsQueryKey(),
            });
        },
    });
}
