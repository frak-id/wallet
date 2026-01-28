import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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

export function useSaveCampaign() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const updateStoreCampaign = campaignStore((state) => state.updateCampaign);

    return useMutation({
        mutationKey: ["campaigns", "save"],
        mutationFn: async (input: SaveCampaignInput): Promise<Campaign> => {
            const { campaignId, ...rest } = input;
            console.log("Saving campaign with input:", input);

            if (campaignId) {
                console.log("Updating campaign with ID:", campaignId);
                const updated = await updateCampaign({ campaignId, ...rest });
                updateStoreCampaign((campaign) => ({
                    ...campaign,
                    id: created.id,
                }));
                return updated;
            }

            const created = await createCampaign(rest);
            updateStoreCampaign((campaign) => ({
                ...campaign,
                id: created.id,
            }));
            return created;
        },
        onSuccess: async (campaign) => {
            campaignStore.getState().reset();

            await queryClient.invalidateQueries({
                queryKey: ["campaigns"],
            });
            await queryClient.invalidateQueries({
                queryKey: ["campaign", campaign.id],
            });

            navigate({ to: "/campaigns/list" });
        },
    });
}
