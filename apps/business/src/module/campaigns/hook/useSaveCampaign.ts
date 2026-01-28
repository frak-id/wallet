import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createCampaign,
    updateCampaign,
} from "@/module/campaigns/api/campaignApi";
import {
    buildApiPayload,
    type CampaignDraft,
    campaignStore,
} from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export function useSaveCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["campaigns", "save"],
        mutationFn: async (draft: CampaignDraft): Promise<Campaign> => {
            const payload = buildApiPayload(draft);

            if (draft.id) {
                return updateCampaign({ campaignId: draft.id, ...payload });
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
