import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import {
    getCampaignDetail,
    getMyCampaigns,
} from "@/module/campaigns/api/campaignApi";
import { getMyCampaignsStats } from "@/module/campaigns/api/campaignStatsApi";
import type { Campaign, CampaignWithActions } from "@/types/Campaign";

type CampaignStateValidator = (campaign: Campaign) => {
    shouldRedirect: boolean;
    redirectTo?: { to: string; params: { campaignId: string } };
};

export const campaignsListQueryOptions = (isDemoMode: boolean) =>
    queryOptions<CampaignWithActions[]>({
        queryKey: ["campaigns", "my-campaigns", isDemoMode ? "demo" : "live"],
        queryFn: () => getMyCampaigns(isDemoMode),
        staleTime: 5 * 60 * 1000,
    });

export const campaignsStatsQueryOptions = (isDemoMode: boolean) =>
    queryOptions({
        queryKey: ["campaigns", "stats", isDemoMode ? "demo" : "live"],
        queryFn: () => getMyCampaignsStats(isDemoMode),
        staleTime: 5 * 60 * 1000,
    });

export const campaignQueryOptions = (
    campaignId: string,
    isDemoMode: boolean,
    merchantId?: string,
    validateState?: CampaignStateValidator
) =>
    queryOptions({
        queryKey: ["campaign", campaignId, isDemoMode ? "demo" : "live"],
        queryFn: async () => {
            const campaign = await getCampaignDetail({
                merchantId,
                campaignId,
                isDemoMode,
            });

            if (!campaign) {
                throw redirect({ to: "/campaigns/list" });
            }

            if (validateState) {
                const validation = validateState(campaign);
                if (validation.shouldRedirect && validation.redirectTo) {
                    throw redirect(validation.redirectTo);
                }
            }

            return campaign;
        },
        staleTime: 5 * 60 * 1000,
    });

export function validateDraftCampaign(campaignId: string) {
    return (campaign: Campaign): ReturnType<CampaignStateValidator> => {
        const isPublished = campaign.status !== "draft";
        if (isPublished) {
            return {
                shouldRedirect: true,
                redirectTo: {
                    to: "/campaigns/edit/$campaignId",
                    params: { campaignId },
                },
            };
        }
        return { shouldRedirect: false };
    };
}

export function validateEditCampaign(campaignId: string) {
    return (campaign: Campaign): ReturnType<CampaignStateValidator> => {
        const isDraft = campaign.status === "draft";
        if (isDraft) {
            return {
                shouldRedirect: true,
                redirectTo: {
                    to: "/campaigns/draft/$campaignId",
                    params: { campaignId },
                },
            };
        }
        return { shouldRedirect: false };
    };
}
