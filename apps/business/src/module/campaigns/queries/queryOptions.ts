import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";

type CampaignStateValidator = (campaign: CampaignDocument) => {
    shouldRedirect: boolean;
    redirectTo?: { to: string; params: { campaignId: string } };
};

/**
 * Query options for fetching campaign details
 * Can be used with optional state validation
 */
export const campaignQueryOptions = (
    campaignId: string,
    validateState?: CampaignStateValidator
) =>
    queryOptions({
        queryKey: ["campaign", campaignId],
        queryFn: async () => {
            const campaign = await getCampaignDetails({
                data: { campaignId },
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
    return (campaign: CampaignDocument): ReturnType<CampaignStateValidator> => {
        const shouldBeInEditMode = campaign.state.key === "created";
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
    return (campaign: CampaignDocument): ReturnType<CampaignStateValidator> => {
        const shouldBeInDraftMode = campaign.state.key !== "created";
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
