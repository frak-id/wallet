import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
    archiveCampaign,
    deleteCampaign,
    pauseCampaign,
} from "@/module/campaigns/api/campaignApi";
import type { CampaignWithActions } from "@/types/Campaign";

type BulkAction = "pause" | "archive" | "delete";

type BulkInput = {
    merchantId: string;
    campaigns: CampaignWithActions[];
};

function runFor(action: BulkAction) {
    switch (action) {
        case "pause":
            return ({
                merchantId,
                campaignId,
            }: {
                merchantId: string;
                campaignId: string;
            }) => pauseCampaign({ merchantId, campaignId });
        case "archive":
            return ({
                merchantId,
                campaignId,
            }: {
                merchantId: string;
                campaignId: string;
            }) => archiveCampaign({ merchantId, campaignId });
        case "delete":
            return ({
                merchantId,
                campaignId,
            }: {
                merchantId: string;
                campaignId: string;
            }) => deleteCampaign({ merchantId, campaignId });
    }
}

export function eligible(
    action: BulkAction,
    campaign: CampaignWithActions
): boolean {
    if (action === "pause") return campaign.actions.canPause;
    if (action === "archive") return campaign.actions.canArchive;
    return campaign.actions.canDelete;
}

export function useBulkCampaignActions() {
    const queryClient = useQueryClient();
    const [pending, setPending] = useState<BulkAction | null>(null);

    const run = useCallback(
        async (action: BulkAction, { merchantId, campaigns }: BulkInput) => {
            const targets = campaigns.filter((c) => eligible(action, c));
            if (targets.length === 0) return;

            setPending(action);
            const fn = runFor(action);
            try {
                await Promise.allSettled(
                    targets.map((c) => fn({ merchantId, campaignId: c.id }))
                );
                await queryClient.invalidateQueries({
                    queryKey: ["campaigns"],
                });
            } finally {
                setPending(null);
            }
        },
        [queryClient]
    );

    return { run, pending };
}

export type { BulkAction };
