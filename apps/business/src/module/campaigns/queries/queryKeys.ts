import type { Currency } from "@frak-labs/core-sdk";

/**
 * Query-key builders for the `campaigns` (list/overview) and `campaign`
 * (single) namespaces. Colocated so the query options and the mutation hooks
 * that invalidate them share one key shape. Scoped variants prefix their base
 * key, so invalidating a base still matches every variant derived from it.
 */

/** Root list/overview key (`["campaigns"]`); invalidating it clears them all. */
export function campaignsQueryKey() {
    return ["campaigns"] as const;
}

/** Mode-scoped campaigns list (`["campaigns", "list", merchantId, mode]`). */
export function campaignsListQueryKey(merchantId: string, isDemoMode: boolean) {
    return [
        ...campaignsQueryKey(),
        "list",
        merchantId,
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Overview summary (KPI cards), keyed by merchant + date window + currency. */
export function overviewSummaryQueryKey(
    merchantId: string,
    isDemoMode: boolean,
    from: string | undefined,
    to: string | undefined,
    currency: Currency
) {
    return [
        ...campaignsQueryKey(),
        "overview",
        "summary",
        merchantId,
        isDemoMode ? "demo" : "live",
        from ?? null,
        to ?? null,
        currency,
    ] as const;
}

/** Overview analytics (funnels), keyed by merchant + date window. */
export function overviewAnalyticsQueryKey(
    merchantId: string,
    isDemoMode: boolean,
    from: string | undefined,
    to: string | undefined
) {
    return [
        ...campaignsQueryKey(),
        "overview",
        "analytics",
        merchantId,
        isDemoMode ? "demo" : "live",
        from ?? null,
        to ?? null,
    ] as const;
}

/** Platform-admin affiliate reporting, keyed by merchant + date window. */
export function affiliateReportQueryKey(
    merchantId: string,
    isDemoMode: boolean,
    from: string | undefined,
    to: string | undefined
) {
    return [
        ...campaignsQueryKey(),
        "affiliate-report",
        merchantId,
        isDemoMode ? "demo" : "live",
        from ?? null,
        to ?? null,
    ] as const;
}

/**
 * Root single-campaign key (`["campaign"]`). Prefix-matches every
 * single-campaign query (config and details, which interleave `merchantId`
 * before `campaignId`), so invalidating it refreshes those caches.
 */
export function campaignQueryKey() {
    return ["campaign"] as const;
}

/** Per-campaign analytics detail sheet, mode-scoped. */
export function campaignDetailsQueryKey(
    merchantId: string,
    campaignId: string,
    isDemoMode: boolean
) {
    return [
        ...campaignQueryKey(),
        "details",
        merchantId,
        campaignId,
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Single campaign config, keyed by merchant + campaign + mode. */
export function campaignConfigQueryKey(
    merchantId: string,
    campaignId: string,
    isDemoMode: boolean
) {
    return [
        ...campaignQueryKey(),
        merchantId,
        campaignId,
        isDemoMode ? "demo" : "live",
    ] as const;
}
