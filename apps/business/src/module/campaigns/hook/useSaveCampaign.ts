import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createCampaign,
    updateCampaign,
} from "@/module/campaigns/api/campaignApi";
import { campaignStore } from "@/stores/campaignStore";
import type {
    BudgetConfig,
    Campaign,
    CampaignMetadata,
    CampaignRuleDefinition,
} from "@/types/Campaign";

type SaveCampaignInput = {
    merchantId: string;
    campaignId?: string;
    name: string;
    rule: CampaignRuleDefinition;
    metadata?: CampaignMetadata;
    budgetConfig?: BudgetConfig;
    expiresAt?: string;
    priority?: number;
};

/**
 * Hook to save (create or update) a campaign draft.
 * Does NOT navigate or reset store - callers handle their own flow.
 */
export function useSaveCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["campaigns", "save"],
        mutationFn: async (input: SaveCampaignInput): Promise<Campaign> => {
            const { campaignId, ...rest } = input;

            if (campaignId) {
                return updateCampaign({ campaignId, ...rest });
            }

            const created = await createCampaign(rest);
            // Store the created ID for subsequent updates
            campaignStore.getState().updateCampaign((c) => ({
                ...c,
                id: created.id,
            }));
            return created;
        },
        onSuccess: async (campaign) => {
            await queryClient.invalidateQueries({
                queryKey: ["campaigns"],
            });
            await queryClient.invalidateQueries({
                queryKey: ["campaign", campaign.id],
            });
        },
    });
}
