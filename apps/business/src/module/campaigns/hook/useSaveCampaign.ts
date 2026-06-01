import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createCampaign,
    updateCampaign,
} from "@/module/campaigns/api/campaignApi";
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
            // Persist the just-saved draft (+ the returned id) back into the
            // store so later wizard steps read the values that were actually
            // saved, not a stale copy. We keep the submitted `draft` (which
            // still carries the UI-only `rewardToken`) rather than rebuilding
            // from the response — at create time the campaign has no rewards
            // yet, so deriving the token from the response would drop it.
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
                // On update, only send rule if rewards are present.
                // The backend validates rule.rewards on PUT but not
                // on POST (create). Step 1 doesn't manage rewards
                // (that's step 2), so sending an empty rewards array
                // on update causes a 400 "Rule must have at least
                // one reward".
                const { rule, ...rest } = payload;
                const includeRule = rule.rewards.length > 0;
                const updated = await updateCampaign({
                    campaignId: draft.id,
                    ...rest,
                    ...(includeRule ? { rule } : {}),
                });
                campaignStore.getState().setDraft(draft);
                return updated;
            }
            const created = await createCampaign(payload);
            campaignStore.getState().setDraft({ ...draft, id: created.id });
            return created;
        },
        onSuccess: async (campaign) => {
            await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            await queryClient.invalidateQueries({
                queryKey: ["campaign", campaign.id],
            });
        },
    });
}
