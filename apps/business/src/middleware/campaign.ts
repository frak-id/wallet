import { redirect } from "@tanstack/react-router";
import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";

type CampaignStateValidator = (campaign: CampaignDocument) => {
    shouldRedirect: boolean;
    redirectTo?: { to: string; params: { campaignId: string } };
};

/**
 * Loader function for campaign routes
 * Handles campaign fetching and optional state validation (without auth check)
 *
 * Use this in loader with requireAuth in beforeLoad for better separation of concerns
 *
 * @example
 * // Basic usage (view route - no state validation)
 * export const Route = createFileRoute("/campaigns/$campaignId")({
 *     beforeLoad: requireAuth,
 *     loader: async ({ params }) => {
 *         return loadCampaignData({ params });
 *     },
 * });
 *
 * @example
 * // Draft route - only allow non-created campaigns
 * export const Route = createFileRoute("/campaigns/draft/$campaignId")({
 *     beforeLoad: requireAuth,
 *     loader: async ({ params }) => {
 *         return loadCampaignData({
 *             params,
 *             validateState: validateDraftCampaign(params.campaignId),
 *         });
 *     },
 * });
 */
export async function loadCampaignData({
    params,
    validateState,
}: {
    params: { campaignId: string };
    validateState?: CampaignStateValidator;
}) {
    // Fetch campaign details
    const campaign = await getCampaignDetails({
        data: { campaignId: params.campaignId },
    });

    if (!campaign) {
        throw redirect({ to: "/campaigns/list" });
    }

    // Optional state validation
    if (validateState) {
        const validation = validateState(campaign as CampaignDocument);
        if (validation.shouldRedirect && validation.redirectTo) {
            throw redirect(validation.redirectTo);
        }
    }

    // Return serialized campaign for loader
    return campaign;
}

/**
 * Validator for draft route - redirects if campaign is in "created" state
 *
 * Returns a validator function that needs the campaignId parameter
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
 *
 * Returns a validator function that needs the campaignId parameter
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
