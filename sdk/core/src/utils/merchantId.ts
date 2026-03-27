/**
 * Merchant ID utilities for auto-fetching from backend
 */

import type { Language } from "../types/config";
import type { ResolvedSdkConfig } from "../types/resolvedConfig";
import { getBackendUrl } from "./backendUrl";

const MERCHANT_ID_STORAGE_KEY = "frak-merchant-id";

/**
 * Response from the merchant resolve endpoint
 */
export type MerchantConfigResponse = {
    merchantId: string;
    name: string;
    domain: string;
    allowedDomains: string[];
    sdkConfig?: ResolvedSdkConfig;
};

function getCacheKey(domain: string, lang?: string): string {
    return `${domain}:${lang ?? ""}`;
}

function getTargetDomain(domain?: string): string {
    return (
        domain ??
        (typeof window !== "undefined" ? window.location.hostname : "")
    );
}

/**
 * In-memory cache for merchant config lookups
 * Persists for the session to avoid repeated API calls
 */
const configCache = new Map<string, MerchantConfigResponse>();
const promiseCache = new Map<
    string,
    Promise<MerchantConfigResponse | undefined>
>();

/**
 * Fetch merchant config from backend by domain
 *
 * @param domain - The domain to lookup (defaults to current hostname)
 * @param walletUrl - Optional wallet URL to derive backend URL
 * @param lang - Optional language passed to the resolve endpoint for localized config
 * @returns The merchant config if found, undefined otherwise
 *
 * @example
 * ```ts
 * const config = await fetchMerchantConfig("shop.example.com");
 * if (config) {
 *     // Use config.merchantId, config.sdkConfig, etc.
 * }
 * ```
 */
export async function fetchMerchantConfig(
    domain?: string,
    walletUrl?: string,
    lang?: Language
): Promise<MerchantConfigResponse | undefined> {
    const targetDomain = getTargetDomain(domain);
    if (!targetDomain) {
        return undefined;
    }

    const key = getCacheKey(targetDomain, lang);

    if (configCache.has(key)) {
        return configCache.get(key);
    }

    if (promiseCache.has(key)) {
        return promiseCache.get(key);
    }

    const promise = fetchMerchantConfigInternal(
        targetDomain,
        walletUrl,
        lang
    ).then((result) => {
        promiseCache.delete(key);
        return result;
    });
    promiseCache.set(key, promise);
    return promise;
}

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
    // Fast-path: return cached merchantId from sessionStorage without a network
    // round-trip. This is safe here because callers only need the merchantId
    // string (e.g. trackPurchaseStatus, ensureIdentity). fetchMerchantConfig()
    // intentionally skips this path since it must return the full response
    // (allowedDomains, sdkConfig, etc.).
    if (typeof window !== "undefined") {
        const stored = window.sessionStorage.getItem(MERCHANT_ID_STORAGE_KEY);
        if (stored) {
            return stored;
        }
    }

    const config = await fetchMerchantConfig(domain, walletUrl);
    return config?.merchantId;
}

/**
 * Internal fetch logic
 */
async function fetchMerchantConfigInternal(
    targetDomain: string,
    walletUrl?: string,
    lang?: Language
): Promise<MerchantConfigResponse | undefined> {
    try {
        const backendUrl = getBackendUrl(walletUrl);
        const langParam = lang ? `&lang=${encodeURIComponent(lang)}` : "";
        const response = await fetch(
            `${backendUrl}/user/merchant/resolve?domain=${encodeURIComponent(targetDomain)}${langParam}`
        );

        if (!response.ok) {
            console.warn(
                `[Frak SDK] Merchant lookup failed for domain ${targetDomain}: ${response.status}`
            );
            return undefined;
        }

        const data = (await response.json()) as MerchantConfigResponse;
        configCache.set(getCacheKey(targetDomain, lang), data);

        if (typeof window !== "undefined") {
            window.sessionStorage.setItem(
                MERCHANT_ID_STORAGE_KEY,
                data.merchantId
            );
        }
        return data;
    } catch (error) {
        console.warn("[Frak SDK] Failed to fetch merchant config:", error);
        return undefined;
    }
}

/**
 * Clear the cached merchant config
 * Useful for testing or when switching domains
 */
export function clearMerchantIdCache(): void {
    configCache.clear();
    promiseCache.clear();
    if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(MERCHANT_ID_STORAGE_KEY);
    }
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
    if (config.metadata?.merchantId) {
        return config.metadata.merchantId;
    }

    // Otherwise, try to fetch from backend
    const merchantConfig = await fetchMerchantConfig(undefined, walletUrl);
    return merchantConfig?.merchantId;
}
