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
        expiresAt: null,
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
                campaignStore.getState().updateDraft((d) => ({
                    ...d,
                    id: demoCampaign.id,
                }));
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
                return updateCampaign({
                    campaignId: draft.id,
                    ...rest,
                    ...(includeRule ? { rule } : {}),
                });
            }
            const created = await createCampaign(payload);
            campaignStore.getState().updateDraft((d) => ({
                ...d,
                id: created.id,
            }));
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
