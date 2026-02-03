import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import campaignsMockData from "@/mock/campaigns.json";
import {
    getCampaignDetail,
    getMyCampaigns,
} from "@/module/campaigns/api/campaignApi";
import {
    getMyCampaignsStats,
    getMyCampaignsStatsMock,
} from "@/module/campaigns/api/campaignStatsApi";
import { getCampaignDetailsMockSync } from "@/module/campaigns/api/mock";
import type { Campaign, CampaignWithActions } from "@/types/Campaign";

type CampaignStateValidator = (campaign: Campaign) => {
    shouldRedirect: boolean;
    redirectTo?: { to: string; params: { campaignId: string } };
};

function getCampaignsInitialData(): CampaignWithActions[] {
    return (campaignsMockData as unknown as Campaign[]).map((campaign) => ({
        ...campaign,
        actions: {
            canEdit: campaign.status === "draft",
            canDelete: campaign.status === "draft",
            canPublish: campaign.status === "draft",
            canPause: campaign.status === "active",
            canResume: campaign.status === "paused",
            canArchive:
                campaign.status === "active" || campaign.status === "paused",
        },
    }));
}

export const campaignsListQueryOptions = (isDemoMode: boolean) =>
    queryOptions<CampaignWithActions[]>({
        queryKey: ["campaigns", "my-campaigns", isDemoMode ? "demo" : "live"],
        queryFn: () => getMyCampaigns(isDemoMode),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: isDemoMode ? getCampaignsInitialData() : undefined,
    });

export const campaignsStatsQueryOptions = (isDemoMode: boolean) =>
    queryOptions({
        queryKey: ["campaigns", "stats", isDemoMode ? "demo" : "live"],
        queryFn: () => getMyCampaignsStats(isDemoMode),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: isDemoMode ? getMyCampaignsStatsMock() : undefined,
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
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: isDemoMode
            ? (getCampaignDetailsMockSync(campaignId) ?? undefined)
            : undefined,
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
