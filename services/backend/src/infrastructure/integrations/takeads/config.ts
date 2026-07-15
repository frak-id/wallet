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
    statsAction: "v3/api/stats/action",
    statsClick: "v1/api/stats/click",
} as const;

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
    /** TakeAds brand identifier the action belongs to (our brand externalId). */
    merchantId: number;
    status: TakeAdsActionStatus;
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
    /** ISO 8601 lower bound on `createdAt` (activity-window reporting). */
    createdAtFrom?: string;
    /** ISO 8601 upper bound on `createdAt` (activity-window reporting). */
    createdAtTo?: string;
    /** Restrict to a single TakeAds brand (our brand externalId). */
    merchantId?: number;
    /** Restrict to a single action status. */
    status?: TakeAdsActionStatus;
    /** Opaque string cursor from `meta.next`. */
    next?: string;
    /** Max 500. */
    limit?: number;
};

export type TakeAdsActionListResponse = {
    meta: { limit: number; next: string | null };
    data: TakeAdsAction[];
};

// --- Stats: GET /v1/api/stats/click ------------------------------------------

/**
 * A day-bucketed click count for one `(adspace, program, subId, date)` combo.
 * The clicks report is pre-aggregated by TakeAds — `count` is the total for the
 * bucket, `subId` echoes the deeplink sub-id we minted (used to attribute the
 * click back to a Frak merchant/user).
 */
export type TakeAdsClick = {
    id: number | null;
    adspaceId: string;
    adspaceName: string;
    programId: string;
    programName: string;
    subId: string | null;
    /** Click date, `yyyy-MM-dd`. */
    date: string;
    count: number;
    productId: string;
    updatedAt: string;
};

export type TakeAdsClickListParams = {
    /** `yyyy-MM-dd` inclusive lower bound (needs `dateTo`). */
    dateFrom?: string;
    /** `yyyy-MM-dd` inclusive upper bound (needs `dateFrom`). */
    dateTo?: string;
    /** Restrict to a single program (UUID). */
    programId?: string;
    /** Restrict to a single deeplink sub-id. */
    subId?: string;
    /** Skip the first N items (pagination). */
    offset?: number;
    /** Max 500. */
    limit?: number;
};

export type TakeAdsClickListResponse = {
    meta: { offset: number; limit: number; total: number };
    data: TakeAdsClick[];
};
