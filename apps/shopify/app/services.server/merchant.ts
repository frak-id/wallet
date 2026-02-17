import type { AuthenticatedContext } from "app/types/context";
import { LRUCache } from "lru-cache";
import { backendApi } from "../utils/backendApi";
import { getMerchantIdMetafield, writeMerchantIdMetafield } from "./metafields";
import { shopInfo } from "./shop";

export type MerchantResolveResponse = {
    merchantId: string;
    productId: string;
    name: string;
    domain: string;
};

const merchantIdCache = new LRUCache<string, string>({
    max: 512,
    // Cache for 5 minutes — merchantId rarely changes
    ttl: 5 * 60_000,
});

const merchantInfoCache = new LRUCache<string, MerchantResolveResponse>({
    max: 512,
    ttl: 5 * 60_000,
});

/**
 * Resolve the merchantId for the current shop.
 *
 * Resolution order:
 *  1. In-memory LRU cache
 *  2. Shop metafield (frak.merchant_id)
 *  3. Frak backend API (by stable normalizedDomain)
 *
 * On successful backend resolve, writes the merchantId to the shop
 * metafield so listener.liquid can read it via Liquid.
 */
export async function resolveMerchantId(
    context: AuthenticatedContext
): Promise<string | null> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;

    // 1. Check LRU cache
    const cached = merchantIdCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // 2. Check metafield
    try {
        const metafieldValue = await getMerchantIdMetafield(context);
        if (metafieldValue) {
            merchantIdCache.set(cacheKey, metafieldValue);
            return metafieldValue;
        }
    } catch (error) {
        console.error("[merchantId] metafield read failed:", error);
    }

    // 3. Fetch from Frak backend using stable domain
    const info = await fetchMerchantFromBackend(cacheKey);
    if (!info) {
        return null;
    }
    const merchantId = info.merchantId;
    merchantInfoCache.set(cacheKey, info);

    // Cache + persist to metafield for listener.liquid
    merchantIdCache.set(cacheKey, merchantId);
    writeMerchantIdMetafield(context, merchantId).catch((error) => {
        console.error("[merchantId] metafield write failed:", error);
    });

    return merchantId;
}

/**
 * Resolve the full merchant info for the current shop.
 * Returns name, domain, merchantId, productId.
 */
export async function resolveMerchantInfo(
    context: AuthenticatedContext
): Promise<MerchantResolveResponse | null> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;

    const cached = merchantInfoCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const info = await fetchMerchantFromBackend(cacheKey);
    if (!info) {
        return null;
    }

    merchantInfoCache.set(cacheKey, info);
    // Also populate the id-only cache
    merchantIdCache.set(cacheKey, info.merchantId);

    return info;
}

/**
 * Clear cached merchant data for the current shop.
 * Called after merchant registration so the next resolve fetches fresh data.
 */
export async function clearMerchantCache(
    context: AuthenticatedContext
): Promise<void> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;
    merchantIdCache.delete(cacheKey);
    merchantInfoCache.delete(cacheKey);
}

/**
 * Fetch merchant info from the Frak backend by domain.
 */
async function fetchMerchantFromBackend(
    domain: string
): Promise<MerchantResolveResponse | null> {
    try {
        const response = await backendApi.get("user/merchant/resolve", {
            searchParams: { domain },
            throwHttpErrors: false,
        });

        if (!response.ok) {
            console.error(
                `[merchantId] backend resolve failed (${response.status}) for ${domain}`
            );
            return null;
        }

        return (await response.json()) as MerchantResolveResponse;
    } catch (error) {
        console.error(`[merchantId] fetch failed for domain ${domain}:`, error);
        return null;
    }
}
