import type { Address } from "viem";

/**
 * Query-key builders for everything under the `merchant` namespace. Colocated
 * so the many hooks that read merchant data and the mutations that invalidate
 * it can never drift on key shape — a mismatch would silently break cache
 * invalidation. Scoped variants prefix the base key, so invalidating a base
 * key still matches every variant derived from it.
 */

/**
 * Root merchant key. Every merchant-scoped query prefixes this, so a single
 * `invalidateQueries({ queryKey: merchantQueryKey() })` clears the whole
 * merchant cache tree.
 */
export function merchantQueryKey() {
    return ["merchant"] as const;
}

/**
 * All queries for one merchant (`["merchant", merchantId]`). Invalidating this
 * matches every mode/sub-scope variant derived from it below.
 */
export function merchantByIdQueryKey(merchantId: string) {
    return [...merchantQueryKey(), merchantId] as const;
}

/** Mode-scoped single-merchant detail (`["merchant", merchantId, mode]`). */
export function merchantDetailQueryKey(
    merchantId: string,
    isDemoMode: boolean
) {
    return [
        ...merchantByIdQueryKey(merchantId),
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Merchant bank state (`["merchant", merchantId, "bank"]`). */
export function merchantBankQueryKey(merchantId: string) {
    return [...merchantByIdQueryKey(merchantId), "bank"] as const;
}

/** Mode-scoped merchant access/role (`["merchant", merchantId, "access", mode]`). */
export function merchantAccessQueryKey(
    merchantId: string,
    isDemoMode: boolean
) {
    return [
        ...merchantByIdQueryKey(merchantId),
        "access",
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Mode-scoped purchase-webhook status. */
export function merchantPurchaseWebhookStatusQueryKey(
    merchantId: string,
    isDemoMode: boolean
) {
    return [
        ...merchantByIdQueryKey(merchantId),
        "purchase-webhook-status",
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Mode-scoped merchant setup-status checklist. */
export function merchantSetupStatusQueryKey(
    merchantId: string,
    isDemoMode: boolean
) {
    return [
        ...merchantByIdQueryKey(merchantId),
        "setup-status",
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Mode-scoped merchant SDK config. */
export function merchantSdkConfigQueryKey(
    merchantId: string,
    isDemoMode: boolean
) {
    return [
        ...merchantByIdQueryKey(merchantId),
        "sdk-config",
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Base team/administrators key (`["merchant", "team", merchantId]`). */
export function merchantTeamQueryKey(merchantId: string) {
    return [...merchantQueryKey(), "team", merchantId] as const;
}

/** Mode-scoped administrators list; prefixed by {@link merchantTeamQueryKey}. */
export function merchantTeamListQueryKey(
    merchantId: string,
    isDemoMode: boolean
) {
    return [
        ...merchantTeamQueryKey(merchantId),
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Mode-scoped "my merchants" list (`["merchant", "my", mode]`). */
export function myMerchantsQueryKey(isDemoMode: boolean) {
    return [...merchantQueryKey(), "my", isDemoMode ? "demo" : "live"] as const;
}

/** DNS TXT record lookup for merchant-domain registration. */
export function merchantDnsRecordQueryKey(domain: string | undefined) {
    return [...merchantQueryKey(), "register", "dns-record", domain] as const;
}

/** Base merchant-media library key (`["media", "list", merchantId]`). */
export function mediaListQueryKey(merchantId: string) {
    return ["media", "list", merchantId] as const;
}

/** Mode-scoped media list; prefixed by {@link mediaListQueryKey}. */
export function mediaListByModeQueryKey(
    merchantId: string,
    isDemoMode: boolean
) {
    return [
        ...mediaListQueryKey(merchantId),
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Root legacy-bank key (`["legacy-bank"]`). */
export function legacyBankQueryKey() {
    return ["legacy-bank"] as const;
}

/** Legacy-bank status for a specific old bank address. */
export function legacyBankStatusQueryKey(oldBankAddress: Address | undefined) {
    return [...legacyBankQueryKey(), oldBankAddress] as const;
}
