import { LruMap } from "./lruMap";

type CacheEntry<TData> = {
    data: TData;
    created: number;
};

/** Global cache for in-flight promises (dedup concurrent calls) */
const promiseCache = new LruMap<Promise<unknown>>(1024);

/** Global cache for resolved responses (TTL-based) */
const responseCache = new LruMap<CacheEntry<unknown>>(1024);

/** Default cache time: 30 seconds */
export const DEFAULT_CACHE_TIME = 30_000;

/** Short negative cache to avoid flooding on transient failures */
const NEGATIVE_CACHE_TIME = 1_000;

/** Tracks recently failed keys to avoid request floods */
const failureCache = new LruMap<number>(1024);

type WithCacheOptions = {
    /** The key to cache the data against */
    cacheKey: string;
    /** Time in ms that cached data will remain valid. Default: 30_000 (30s). Set to 0 to disable caching. */
    cacheTime?: number;
};

/**
 * Returns the result of a given promise, and caches the result for
 * subsequent invocations against a provided cache key.
 *
 * Also deduplicates concurrent calls — if multiple callers request the same
 * cache key while the promise is pending, they share the same promise.
 *
 * @example
 * ```ts
 * // First call fetches, subsequent calls return cached data for 30s
 * const data = await withCache(
 *     () => client.request({ method: "frak_getMerchantInformation" }),
 *     { cacheKey: "merchantInfo", cacheTime: 30_000 }
 * );
 * ```
 */
export async function withCache<TData>(
    fn: () => Promise<TData>,
    { cacheKey, cacheTime = DEFAULT_CACHE_TIME }: WithCacheOptions
): Promise<TData> {
    // Check response cache — return immediately if fresh
    if (cacheTime > 0) {
        const cached = responseCache.get(cacheKey) as
            | CacheEntry<TData>
            | undefined;
        if (cached) {
            const age = Date.now() - cached.created;
            if (age < cacheTime) return cached.data;
        }
    }

    // Check if this key recently failed — back off briefly
    const lastFailure = failureCache.get(cacheKey);
    if (lastFailure && Date.now() - lastFailure < NEGATIVE_CACHE_TIME) {
        throw new Error(`Cache: ${cacheKey} recently failed, backing off`);
    }

    // Check if there's already a pending promise (dedup concurrent calls)
    let promise = promiseCache.get(cacheKey) as Promise<TData> | undefined;
    if (!promise) {
        promise = fn();
        promiseCache.set(cacheKey, promise);
    }

    try {
        const data = await promise;
        // Store the response with a timestamp
        responseCache.set(cacheKey, { data, created: Date.now() });
        // Clear any previous failure
        failureCache.delete(cacheKey);
        return data;
    } catch (error) {
        // Record the failure timestamp
        failureCache.set(cacheKey, Date.now());
        throw error;
    } finally {
        // Clear the promise cache so subsequent calls can re-fetch after TTL
        promiseCache.delete(cacheKey);
    }
}

/**
 * Get a cache handle for a specific key, useful for manual invalidation.
 *
 * @example
 * ```ts
 * // Invalidate merchant info cache after a mutation
 * getCache("frak_getMerchantInformation").clear();
 * ```
 */
export function getCache(cacheKey: string) {
    return {
        /** Clear both the pending promise and the cached response */
        clear: () => {
            promiseCache.delete(cacheKey);
            responseCache.delete(cacheKey);
        },
        /** Check if a non-expired response exists */
        has: (cacheTime: number = DEFAULT_CACHE_TIME) => {
            const cached = responseCache.get(cacheKey);
            if (!cached) return false;
            return Date.now() - cached.created < cacheTime;
        },
    };
}

/**
 * Clear all cached data (both pending promises and resolved responses).
 * Called automatically when the client is destroyed.
 */
export function clearAllCache() {
    promiseCache.clear();
    responseCache.clear();
    failureCache.clear();
}
