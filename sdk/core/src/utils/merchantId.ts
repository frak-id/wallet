/**
 * Merchant ID utilities for auto-fetching from backend
 */

import { getBackendUrl } from "./backendUrl";

/**
 * Response from the merchant lookup endpoint
 */
type MerchantLookupResponse = {
    merchantId: string;
    name: string;
    domain: string;
};

/**
 * In-memory cache for merchantId lookups
 * Persists for the session to avoid repeated API calls
 */
let cachedMerchantId: string | undefined;
let cachePromise: Promise<string | undefined> | undefined;

/**
 * Fetch merchantId from backend by domain
 *
 * @param domain - The domain to lookup (defaults to current hostname)
 * @param walletUrl - Optional wallet URL to derive backend URL
 * @returns The merchantId if found, undefined otherwise
 *
 * @example
 * ```ts
 * const merchantId = await fetchMerchantId("shop.example.com");
 * if (merchantId) {
 *     // Use merchantId for tracking
 * }
 * ```
 */
export async function fetchMerchantId(
    domain?: string,
    walletUrl?: string
): Promise<string | undefined> {
    // Use cached value if available
    if (cachedMerchantId) {
        return cachedMerchantId;
    }

    // If a fetch is already in progress, wait for it
    if (cachePromise) {
        return cachePromise;
    }

    // Start the fetch and cache the promise
    cachePromise = fetchMerchantIdInternal(domain, walletUrl);
    const result = await cachePromise;
    cachePromise = undefined;
    return result;
}

/**
 * Internal fetch logic
 */
async function fetchMerchantIdInternal(
    domain?: string,
    walletUrl?: string
): Promise<string | undefined> {
    const targetDomain =
        domain ??
        (typeof window !== "undefined" ? window.location.hostname : "");
    if (!targetDomain) {
        return undefined;
    }

    try {
        const backendUrl = getBackendUrl(walletUrl);
        const response = await fetch(
            `${backendUrl}/user/merchant/resolve?domain=${encodeURIComponent(targetDomain)}`
        );

        if (!response.ok) {
            console.warn(
                `[Frak SDK] Merchant lookup failed for domain ${targetDomain}: ${response.status}`
            );
            return undefined;
        }

        const data = (await response.json()) as MerchantLookupResponse;
        cachedMerchantId = data.merchantId;
        return cachedMerchantId;
    } catch (error) {
        console.warn("[Frak SDK] Failed to fetch merchantId:", error);
        return undefined;
    }
}

/**
 * Clear the cached merchantId
 * Useful for testing or when switching domains
 */
export function clearMerchantIdCache(): void {
    cachedMerchantId = undefined;
    cachePromise = undefined;
}

/**
 * Get merchantId from config or auto-fetch from backend
 *
 * @param config - The SDK config that may contain merchantId
 * @param walletUrl - Optional wallet URL to derive backend URL
 * @returns The merchantId if available (from config or fetch), undefined otherwise
 */
export async function resolveMerchantId(
    config: { metadata?: { merchantId?: string } },
    walletUrl?: string
): Promise<string | undefined> {
    // First, check config
    if (config.metadata?.merchantId) {
        return config.metadata.merchantId;
    }

    // Otherwise, try to fetch from backend
    return fetchMerchantId(undefined, walletUrl);
}
