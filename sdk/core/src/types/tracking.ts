import type { Address } from "viem";

export type UtmParams = {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
};

/**
 * Attribution parameters appended to outbound sharing URLs.
 *
 * Defaults are derived from the V2 Frak context when available:
 * - `utmSource`: `"frak"`
 * - `utmMedium`: `"referral"`
 * - `utmCampaign`: merchantId (`context.m`)
 * - `via`: `"frak"`
 * - `ref`: clientId (`context.c`)
 *
 * Fields explicitly set here override the defaults. Existing params on the
 * base URL are preserved (gap-fill policy) to respect merchant-provided UTMs.
 */
export type AttributionParams = {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    via?: string;
    ref?: string;
};

export type TrackArrivalParams = {
    /** @deprecated V1 legacy — use referrerClientId for v2 contexts */
    referrerWallet?: Address;
    referrerClientId?: string;
    referrerMerchantId?: string;
    /** Epoch seconds timestamp from the referral link creation */
    referralTimestamp?: number;
    landingUrl?: string;
    utmParams?: UtmParams;
};

export type TrackArrivalResult = {
    success: boolean;
    identityGroupId?: string;
    touchpointId?: string;
    error?: string;
};

export type TrackArrivalInternalParams = TrackArrivalParams & {
    merchantId: string;
};
