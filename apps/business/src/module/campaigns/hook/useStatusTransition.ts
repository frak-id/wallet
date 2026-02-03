import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    archiveCampaign,
    pauseCampaign,
    publishCampaign,
    resumeCampaign,
} from "@/module/campaigns/api/campaignApi";
import type { Campaign, CampaignStatus } from "@/types/Campaign";

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
        onSuccess: async (_data, { campaignId }) => {
            await queryClient.invalidateQueries({
                queryKey: ["campaigns"],
            });
            await queryClient.invalidateQueries({
                queryKey: ["campaign", campaignId],
            });
        },
    });
}

export function getAvailableTransitions(
    status: CampaignStatus
): StatusTransitionAction[] {
    switch (status) {
        case "draft":
            return ["publish"];
        case "active":
            return ["pause", "archive"];
        case "paused":
            return ["resume", "archive"];
        default:
            return [];
    }
}
