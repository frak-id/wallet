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

/**
 * Merchant-level attribution defaults.
 *
 * Same shape as {@link AttributionParams} minus `utmContent`, because
 * `utm_content` describes the specific content/creative being shared and is
 * inherently per-call or per-product (never a merchant-wide default).
 *
 * Used as the shape for both:
 * - `FrakWalletSdkConfig.attribution` (SDK-side compile-time defaults)
 * - Backend merchant-config attribution (dashboard-driven defaults)
 */
export type AttributionDefaults = Omit<AttributionParams, "utmContent">;

export type TrackArrivalParams = {
    /** Sharer wallet address. Accepted in both V1 (legacy) and V2 (authenticated sharer) contexts. */
    referrerWallet?: Address;
    referrerClientId?: string;
    referrerMerchantId?: string;
    /** Epoch seconds timestamp from the referral link creation */
    referralTimestamp?: number;
};

export type TrackArrivalResult = {
    success: boolean;
    identityGroupId?: string;
    referralLinkId?: string;
    error?: string;
};

export type TrackArrivalInternalParams = TrackArrivalParams & {
    merchantId: string;
};
