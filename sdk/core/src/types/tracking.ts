import type { Address } from "viem";

export type UtmParams = {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
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
