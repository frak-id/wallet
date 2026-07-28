import type { Address } from "viem";

/**
 * Query-key builders for the cross-cutting common hooks (token conversion
 * rates and on-chain ERC-20 metadata). Colocated so reads stay consistent with
 * any future invalidations.
 */

/** Mode-scoped token conversion rate (`["conversionRate", token, mode]`). */
export function conversionRateQueryKey(
    token: Address | undefined,
    isDemoMode: boolean | undefined
) {
    return ["conversionRate", token, isDemoMode ? "demo" : "live"] as const;
}

/** On-chain ERC-20 metadata for a token (`["tokenMetadata", tokenAddress]`). */
export function tokenMetadataQueryKey(tokenAddress: Address | undefined) {
    return ["tokenMetadata", tokenAddress] as const;
}
