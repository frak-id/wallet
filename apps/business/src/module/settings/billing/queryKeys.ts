/**
 * Shared query-key builders and validation patterns for the billing module.
 * Centralised so the hooks that read the documents list
 * (`useBillingInfo`) and the ones that mutate it (`useBillingAdmin`) can never
 * drift on the key shape — a mismatch would silently break cache
 * invalidation.
 */

/** Merchant accounting-info query key (`/:merchantId/billing/accounting`). */
export function accountingQueryKey(merchantId: string) {
    return ["billing", "accounting", merchantId] as const;
}

/**
 * Billing documents query key (`/:merchantId/billing/documents`). Every
 * document-mutating hook invalidates this exact key, and the scoped variants
 * below prefix it so a single invalidation of this key still matches them.
 */
export function documentsQueryKey(merchantId: string) {
    return ["billing", "documents", merchantId] as const;
}

/**
 * Kind-scoped documents query key (e.g. the withdraw sheet's linkable-deposit
 * picker). Derived from {@link documentsQueryKey} so invalidating the
 * documents key prefix keeps matching it.
 */
export function documentsByKindQueryKey(merchantId: string, kind: string) {
    return [...documentsQueryKey(merchantId), kind] as const;
}

/** Positive decimal amount, e.g. "1200" or "12.50". */
export const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

/** Non-empty `0x`-prefixed hex string (transaction hash). */
export const TX_HASH_PATTERN = /^0x[0-9a-fA-F]+$/;
