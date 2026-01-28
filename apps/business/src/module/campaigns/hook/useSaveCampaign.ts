import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
    createCampaign,
    updateCampaign,
} from "@/context/campaigns/action/createCampaign";
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

    return useMutation({
        mutationKey: ["campaigns", "save"],
        mutationFn: async (input: SaveCampaignInput): Promise<Campaign> => {
            const { campaignId, ...rest } = input;

            if (campaignId) {
                return await updateCampaign({
                    data: { campaignId, ...rest },
                });
            }

            return await createCampaign({ data: rest });
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
