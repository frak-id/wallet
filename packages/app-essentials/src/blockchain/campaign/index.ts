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
