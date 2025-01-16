import type { Hex } from "viem";

/**
 * The different campaign types
 */
export type CampaignType =
    // Affiliation based campaign with a fixed reward trigger
    | "frak.campaign.affiliation-fixed"
    // Affiliation based campaign with a range reward trigger (following a beta distribution curve)
    | "frak.campaign.affiliation-range"
    // @deprecated Same as the affiliation-fixed campaign with old logics
    | "frak.campaign.referral";

/**
 * The base storage ptr where each campaign trigger are stored depending on the campaign type
 */
export const baseCampaignTriggerPtr: Record<CampaignType, Hex> = {
    "frak.campaign.affiliation-fixed":
        "0x000000009a66eab1dc06cf965a5dd434da376bfb8a26e5a07827dbae9f11e304",
    "frak.campaign.affiliation-range":
        "0x00000000b550be2e7c521e77be22747addea3d6f7ff1122a402603db55359db9",
    "frak.campaign.referral":
        "0x2b590e368f6e51c03042de6eb3d37f464929de3b3f869c37f1eb01ab",
};
