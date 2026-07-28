import type { GetMembersParam } from "@/module/members/api/getMerchantMembers";

/**
 * Query-key builders for the members module (members table, push history, and
 * the create-push audience-count preview). Colocated so reads and the
 * mutations that invalidate them share one key shape.
 */

/** Mode-scoped members table page, keyed by merchant + resolved filters. */
export function membersPageQueryKey(
    merchantId: string,
    scoped: GetMembersParam,
    isDemoMode: boolean
) {
    return [
        "members",
        "page",
        merchantId,
        scoped,
        isDemoMode ? "demo" : "live",
    ] as const;
}

/** Push-notification broadcast history for a merchant. */
export function pushHistoryQueryKey(merchantId: string) {
    return ["push", "history", merchantId] as const;
}

/**
 * Live audience-count preview for the create-push composer. Keyed by the
 * (debounced) filter and demo flag; the generic keeps the caller's exact
 * filter type in the tuple.
 */
export function audienceCountQueryKey<TFilter>(
    filter: TFilter,
    isDemoMode: boolean
) {
    return ["create-push", "audience-count", filter, isDemoMode] as const;
}
