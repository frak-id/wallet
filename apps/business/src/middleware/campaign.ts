import { redirect } from "@tanstack/react-router";
import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { requireAuth } from "./auth";

type CampaignStateValidator = (campaign: CampaignDocument) => {
    shouldRedirect: boolean;
    redirectTo?: { to: string; params: { campaignId: string } };
};

type LoadCampaignOptions = {
    params: { campaignId: string };
    location: { href: string };
    validateState?: CampaignStateValidator;
};

/**
 * beforeLoad hook for campaign routes
 * Handles authentication, campaign fetching, and optional state validation
 *
 * @example
 * // Basic usage (view route - no state validation)
 * beforeLoad: async ({ params, location }) => {
 *     return loadCampaign({ params, location });
 * }
 *
 * @example
 * // Draft route - only allow non-created campaigns
 * beforeLoad: async ({ params, location }) => {
 *     return loadCampaign({
 *         params,
 *         location,
 *         validateState: validateDraftCampaign,
 *     });
 * }
 */
export async function loadCampaign({
    params,
    location,
    validateState,
}: LoadCampaignOptions) {
    // Require authentication
    const { session } = await requireAuth({ location });

    // Fetch campaign details
    const campaign = await getCampaignDetails({
        data: { campaignId: params.campaignId },
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

    return { session, campaign };
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
