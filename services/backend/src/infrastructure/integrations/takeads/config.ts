/**
 * Types for the subset of the TakeAds (Mitgo) Monetize/Take API we consume.
 *
 * Base URL: https://api.takeads.com — auth via `Authorization: Bearer <key>`.
 * Public docs: https://developers.mitgo.com / https://docs.takeads.com
 *
 * Only the fields used by the integration are modelled; the API returns more.
 * Field names mirror the API verbatim (e.g. the catalog logo is `imageUri`,
 * stats amounts are `orderAmount` + `publisherRevenue`) so callers never guess.
 */

export const TAKEADS_BASE_URL = "https://api.takeads.com";

/** Path segments (the API mixes version prefixes, so each call is absolute). */
export const TAKEADS_PATHS = {
    merchants: "v1/product/monetize-api/v2/merchant",
    resolve: "v1/product/monetize-api/v2/resolve",
    statsAction: "v3/api/stats/action",
} as const;

// --- Catalog: GET /v1/product/monetize-api/v2/merchant -----------------------

/**
 * One reward tier the publisher can earn per approved action. A merchant may
 * expose several; the actual payout depends on what the merchant approves.
 */
export type TakeAdsCommissionRate = {
    /** Flat amount paid per transaction/lead. */
    fixedCommission: number;
    /** Percent of the order total paid per transaction. */
    percentageCommission: number;
};

export type TakeAdsMerchant = {
    /** Unique merchant id (null for a few catalog edge cases). */
    merchantId: number | null;
    name: string;
    /** URI of the merchant logo (null when absent). */
    imageUri: string | null;
    defaultDomain: string;
    description: string;
    domains: string[];
    /** ISO 4217 alpha-3. */
    currencyCode: string;
    /** A merchant is active when it has at least one active program. */
    isActive: boolean;
    deeplinkAllowed: boolean;
    countryCodes: string[];
    commissionRates: TakeAdsCommissionRate[];
    /** Base merchant tracking link (subId/deeplink appended client-side). */
    trackingLink: string;
    /** ISO 8601. */
    updatedAt: string;
};

export type TakeAdsMerchantListParams = {
    /** Pointer to the next page (integer cursor from `meta.next`). */
    next?: number;
    /** Max 500, default 100. */
    limit?: number;
    /** ISO 8601 lower bound on `updatedAt`. */
    updatedAtFrom?: string;
    isActive?: boolean;
    deeplinkAllowed?: boolean;
};

export type TakeAdsMerchantListResponse = {
    meta: { next: number | null };
    data: TakeAdsMerchant[];
};

// --- Link resolution: PUT /v1/product/monetize-api/v2/resolve ----------------

export type TakeAdsResolveBody = {
    /** Links to affiliate (IRI, RFC 3987). */
    iris: string[];
    /**
     * SubID added to every returned tracking link. One per request.
     * Allowed: digits, Latin letters, `_` and `-`; up to 6144 chars.
     */
    subId?: string;
    /** Include the advertiser logo URL in the response. */
    withImages?: boolean;
};

export type TakeAdsResolveItem = {
    /** The IRI sent in the request. */
    iri: string;
    /** Affiliate link; `s` (subId) and `url` (deeplink) are tweakable after. */
    trackingLink: string;
    /** Advertiser logo (only when `withImages` was set), else null. */
    imageUrl: string | null;
};

export type TakeAdsResolveResponse = {
    /** Empty when no advertiser offer matched the IRI. */
    data: TakeAdsResolveItem[];
};

// --- Stats: GET /v3/api/stats/action -----------------------------------------

/**
 * Action lifecycle. CONFIRMED auto-transitions to SETTLED after ~45-50 days.
 * CANCELED is the decline terminal state (the plan's "DECLINED").
 */
export type TakeAdsActionStatus =
    | "PENDING"
    | "CONFIRMED"
    | "CANCELED"
    | "SETTLED";

/** Pricing model of the action. */
export type TakeAdsActionType = "LEAD" | "SALE" | "CLICK" | "BONUS";

export type TakeAdsAction = {
    /** Stable unique id assigned by TakeAds (use for idempotency). */
    actionId: string;
    actionNumericId: number;
    merchantId: number;
    status: TakeAdsActionStatus;
    advertiserPaid: boolean;
    /** Echo of the subId we minted at link generation. */
    subId: string;
    /** Buyer's order total (the purchase amount). */
    orderAmount: number;
    /** Our publisher payout (the commission). */
    publisherRevenue: number;
    /** ISO 4217 alpha-3 for `orderAmount` + `publisherRevenue`. */
    currencyCode: string;
    type: TakeAdsActionType;
    orderDate: string;
    createdAt: string;
    /** Date of the last update — drives the polling watermark. */
    updatedAt: string;
    countryCode: string;
};

export type TakeAdsActionListParams = {
    /** ISO 8601 lower bound on `updatedAt` (the polling watermark). */
    updatedAtFrom?: string;
    updatedAtTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    status?: TakeAdsActionStatus;
    subId?: string;
    merchantId?: number;
    /** Opaque string cursor from `meta.next`. */
    next?: string;
    /** Max 500. */
    limit?: number;
};

export type TakeAdsActionListResponse = {
    meta: { limit: number; next: string | null };
    data: TakeAdsAction[];
};
