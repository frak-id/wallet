import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { getMyCampaigns } from "@/context/campaigns/action/getCampaigns";
import { getCampaignDetail } from "@/context/campaigns/action/getDetails";
import type { Campaign, CampaignWithActions } from "@/types/Campaign";

type CampaignStateValidator = (campaign: Campaign) => {
    shouldRedirect: boolean;
    redirectTo?: { to: string; params: { campaignId: string } };
};

/**
 * Query options for fetching all campaigns for the current user
 * @returns CampaignWithActions[] — campaigns with available action flags
 */
export const campaignsListQueryOptions = (isDemoMode: boolean) =>
    queryOptions<CampaignWithActions[]>({
        queryKey: ["campaigns", "my-campaigns", isDemoMode ? "demo" : "live"],
        queryFn: async () => {
            return await getMyCampaigns();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

/**
 * Query options for fetching campaign performance stats
 */
export const campaignsStatsQueryOptions = () =>
    queryOptions({
        queryKey: ["campaigns", "stats"],
        queryFn: async () => {
            const { getMyCampaignsStats } = await import(
                "@/context/campaigns/action/getCampaignsStats"
            );
            return await getMyCampaignsStats({ data: undefined });
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

/**
 * Query options for fetching campaign details
 * Can be used with optional state validation
 */
export const campaignQueryOptions = (
    campaignId: string,
    merchantId?: string,
    validateState?: CampaignStateValidator
) =>
    queryOptions({
        queryKey: ["campaign", campaignId],
        queryFn: async () => {
            const campaign = await getCampaignDetail({
                data: { merchantId, campaignId },
            });

            if (!campaign) {
                throw redirect({ to: "/campaigns/list" });
            }

            // Optional state validation
            if (validateState) {
                const validation = validateState(campaign);
                if (validation.shouldRedirect && validation.redirectTo) {
                    throw redirect(validation.redirectTo);
                }
            }

            return campaign;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

/**
 * Validator for draft route - redirects if campaign is in "created" state
 */
export function validateDraftCampaign(campaignId: string) {
    return (campaign: Campaign): ReturnType<CampaignStateValidator> => {
        const shouldBeInEditMode = campaign.status === "draft";
        if (shouldBeInEditMode) {
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

/**
 * Validator for edit route - redirects if campaign is NOT in "created" state
 */
export function validateEditCampaign(campaignId: string) {
    return (campaign: Campaign): ReturnType<CampaignStateValidator> => {
        const shouldBeInDraftMode = campaign.status !== "draft";
        if (shouldBeInDraftMode) {
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
