import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    archiveCampaign,
    pauseCampaign,
    publishCampaign,
    resumeCampaign,
} from "@/module/campaigns/api/campaignApi";
import {
    campaignQueryKey,
    campaignsQueryKey,
} from "@/module/campaigns/queries/queryKeys";
import type { Campaign } from "@/types/Campaign";

type StatusTransitionAction = "publish" | "pause" | "resume" | "archive";

type StatusTransitionInput = {
    merchantId: string;
    campaignId: string;
    action: StatusTransitionAction;
};

const transitionFns: Record<
    StatusTransitionAction,
    (args: { merchantId: string; campaignId: string }) => Promise<Campaign>
> = {
    publish: publishCampaign,
    pause: pauseCampaign,
    resume: resumeCampaign,
    archive: archiveCampaign,
};

export function useStatusTransition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["campaigns", "status-transition"],
        mutationFn: async ({
            merchantId,
            campaignId,
            action,
        }: StatusTransitionInput): Promise<Campaign> => {
            const fn = transitionFns[action];
            return fn({ merchantId, campaignId });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: campaignsQueryKey(),
            });
            // Root single-campaign key: prefix-matches both the config
            // (`["campaign", merchantId, id, mode]`) and details
            // (`["campaign", "details", ...]`) caches so the details sheet
            // refetches after a transition.
            await queryClient.invalidateQueries({
                queryKey: campaignQueryKey(),
            });
        },
    });
}
