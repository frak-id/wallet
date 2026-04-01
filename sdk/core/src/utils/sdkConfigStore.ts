/**
 * SDK config store — reactive singleton for the resolved merchant config.
 *
 * State lives directly on `window.__frakSdkConfig`.
 * Reactivity is handled via the `frak:config` CustomEvent on `window`.
 * Resolved configs are cached in localStorage (30 s TTL, stale-while-revalidate).
 *
 * Also owns merchant config fetching (resolve), promise deduplication,
 * and the `frak-merchant-id` sessionStorage compatibility key.
 */

import type { Language } from "../types/config";
import type {
    MerchantConfigResponse,
    SdkResolvedConfig,
} from "../types/resolvedConfig";
import { getBackendUrl } from "./backendUrl";

const GLOBAL_KEY = "__frakSdkConfig";
const CACHE_TTL = 30_000; // 30 seconds
const DEFAULT_CACHE_KEY = "frak-config-cache";
const MERCHANT_ID_KEY = "frak-merchant-id";

const cacheState = { key: DEFAULT_CACHE_KEY };

const isBrowser = typeof window !== "undefined";

type CacheEntry = { config: SdkResolvedConfig; timestamp: number };

declare global {
    interface Window {
        [GLOBAL_KEY]?: SdkResolvedConfig;
    }
    interface WindowEventMap {
        "frak:config": CustomEvent<SdkResolvedConfig>;
    }
}

function freshEmptyConfig(): SdkResolvedConfig {
    return { isResolved: false, merchantId: "" };
}

// ---------------------------------------------------------------------------
// localStorage cache (with in-memory parsed copy)
// ---------------------------------------------------------------------------

let memoryEntry: CacheEntry | null = null;

function loadCacheEntry(): CacheEntry | null {
    if (!isBrowser) return null;
    try {
        const raw = localStorage.getItem(cacheState.key);
        if (!raw) return null;
        const entry: CacheEntry = JSON.parse(raw);
        if (!entry.config?.isResolved) return null;
        memoryEntry = entry;
        return entry;
    } catch {
        return null;
    }
}

function readCache(): SdkResolvedConfig | undefined {
    return (memoryEntry ?? loadCacheEntry())?.config;
}

function isCacheFresh(): boolean {
    const entry = memoryEntry ?? loadCacheEntry();
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL;
}

function writeCache(config: SdkResolvedConfig): void {
    if (!isBrowser || !config.isResolved) return;
    try {
        const entry: CacheEntry = { config, timestamp: Date.now() };
        localStorage.setItem(cacheState.key, JSON.stringify(entry));
        memoryEntry = entry;
    } catch {}
}

function removeCache(): void {
    if (!isBrowser) return;
    memoryEntry = null;
    try {
        localStorage.removeItem(cacheState.key);
    } catch {}
}

// ---------------------------------------------------------------------------
// Initialise window-backed config (once per bundle boundary)
// ---------------------------------------------------------------------------

function initConfig(): void {
    if (!isBrowser) return;
    if (window[GLOBAL_KEY]) return;
    window[GLOBAL_KEY] = readCache() ?? freshEmptyConfig();
}

initConfig();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig(): SdkResolvedConfig {
    if (!isBrowser) return freshEmptyConfig();
    return window[GLOBAL_KEY] ?? freshEmptyConfig();
}

function dispatch(config: SdkResolvedConfig): void {
    if (!isBrowser) return;
    window.dispatchEvent(new CustomEvent("frak:config", { detail: config }));
}

function getTargetDomain(domain?: string): string {
    return domain ?? (isBrowser ? window.location.hostname : "");
}

// ---------------------------------------------------------------------------
// Merchant config fetching (resolve) + dedup
// ---------------------------------------------------------------------------

const responseCache = new Map<string, MerchantConfigResponse>();
const promiseCache = new Map<
    string,
    Promise<MerchantConfigResponse | undefined>
>();

function resolveCacheKey(domain: string, lang?: string): string {
    return `${domain}:${lang ?? ""}`;
}

async function fetchFromBackend(
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
        const key = resolveCacheKey(targetDomain, lang);
        responseCache.set(key, data);

        // Write compatibility sessionStorage key
        if (isBrowser) {
            try {
                sessionStorage.setItem(MERCHANT_ID_KEY, data.merchantId);
            } catch {}
        }

        return data;
    } catch (error) {
        console.warn("[Frak SDK] Failed to fetch merchant config:", error);
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const sdkConfigStore = {
    getConfig,

    get isResolved(): boolean {
        return getConfig().isResolved;
    },

    get isCacheFresh(): boolean {
        return isCacheFresh();
    },

    setCacheScope(domain: string, lang?: string): void {
        const suffix = `${domain}:${lang ?? ""}`;
        cacheState.key = `${DEFAULT_CACHE_KEY}:${suffix}`;
        memoryEntry = null;
    },

    setConfig(config: SdkResolvedConfig): void {
        if (isBrowser) window[GLOBAL_KEY] = config;
        writeCache(config);
        dispatch(config);

        // Keep sessionStorage merchantId in sync
        if (isBrowser && config.merchantId) {
            try {
                sessionStorage.setItem(MERCHANT_ID_KEY, config.merchantId);
            } catch {}
        }
    },

    reset(): void {
        const next = readCache() ?? freshEmptyConfig();
        if (isBrowser) window[GLOBAL_KEY] = next;
        dispatch(next);
    },

    clearCache(): void {
        removeCache();
        responseCache.clear();
        promiseCache.clear();
        if (isBrowser) {
            try {
                sessionStorage.removeItem(MERCHANT_ID_KEY);
            } catch {}
        }
    },

    resolve(
        domain?: string,
        walletUrl?: string,
        lang?: Language
    ): Promise<MerchantConfigResponse | undefined> {
        const targetDomain = getTargetDomain(domain);
        if (!targetDomain) {
            return Promise.resolve(undefined);
        }

        const key = resolveCacheKey(targetDomain, lang);

        if (responseCache.has(key)) {
            return Promise.resolve(responseCache.get(key));
        }

        const pending = promiseCache.get(key);
        if (pending) {
            return pending;
        }

        const promise = fetchFromBackend(targetDomain, walletUrl, lang).then(
            (result) => {
                promiseCache.delete(key);
                return result;
            }
        );
        promiseCache.set(key, promise);
        return promise;
    },

    getMerchantId(): string | undefined {
        const config = getConfig();
        if (config.isResolved && config.merchantId) {
            return config.merchantId;
        }

        if (isBrowser) {
            try {
                return sessionStorage.getItem(MERCHANT_ID_KEY) ?? undefined;
            } catch {}
        }
        return undefined;
    },

    async resolveMerchantId(
        domain?: string,
        walletUrl?: string
    ): Promise<string | undefined> {
        const fast = sdkConfigStore.getMerchantId();
        if (fast) return fast;

        const config = await sdkConfigStore.resolve(domain, walletUrl);
        return config?.merchantId;
    },
};
