/**
 * SDK config store — reactive singleton for the resolved merchant config.
 *
 * State lives directly on `window.__frakSdkConfig`.
 * Reactivity is handled via the `frak:config` CustomEvent on `window`.
 * Resolved configs are cached in localStorage (30 s TTL, stale-while-revalidate).
 */

import type { SdkResolvedConfig } from "../types/resolvedConfig";

const GLOBAL_KEY = "__frakSdkConfig";
const CACHE_KEY = "frak-config-cache";
const LEGACY_CACHE_KEY = "frak:configCache";
const CACHE_TTL = 30_000; // 30 seconds

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
        let raw = localStorage.getItem(CACHE_KEY);
        if (!raw) {
            raw = localStorage.getItem(LEGACY_CACHE_KEY);
            if (raw) {
                localStorage.setItem(CACHE_KEY, raw);
                localStorage.removeItem(LEGACY_CACHE_KEY);
            }
        }
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
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
        memoryEntry = entry;
    } catch {}
}

function removeCache(): void {
    if (!isBrowser) return;
    memoryEntry = null;
    try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(LEGACY_CACHE_KEY);
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

    setConfig(config: SdkResolvedConfig): void {
        if (isBrowser) window[GLOBAL_KEY] = config;
        writeCache(config);
        dispatch(config);
    },

    reset(): void {
        const next = readCache() ?? freshEmptyConfig();
        if (isBrowser) window[GLOBAL_KEY] = next;
        dispatch(next);
    },

    clearCache(): void {
        removeCache();
    },
};
