/**
 * SDK config store — reactive singleton for the resolved merchant configuration.
 * Populated after the backend `/resolve` call completes; components subscribe
 * to receive updates without polling.
 */

import type {
    ResolvedPlacement,
    SdkResolvedConfig,
} from "../types/resolvedConfig";

type SdkConfigStoreListener = (config: SdkResolvedConfig) => void;

const listeners = new Set<SdkConfigStoreListener>();
let currentConfig: SdkResolvedConfig = {
    isResolved: false,
    merchantId: "",
};

/**
 * Singleton store for the resolved SDK configuration.
 *
 * Components should subscribe via `sdkConfigStore.subscribe()` to reactively
 * receive config updates, and read the current snapshot via `sdkConfigStore.getConfig()`.
 *
 * @example
 * ```ts
 * // Subscribe to config updates
 * const unsubscribe = sdkConfigStore.subscribe((config) => {
 *     if (config.isResolved) {
 *         console.log("Merchant:", config.merchantId);
 *     }
 * });
 *
 * // Later, clean up
 * unsubscribe();
 * ```
 */
export const sdkConfigStore = {
    /**
     * Returns the current resolved config snapshot.
     */
    getConfig(): SdkResolvedConfig {
        return currentConfig;
    },

    /**
     * Replaces the current config and notifies all subscribers.
     * @param config - The new resolved config
     */
    setConfig(config: SdkResolvedConfig): void {
        currentConfig = config;
        for (const listener of listeners) {
            listener(config);
        }
    },

    /**
     * Subscribes to config changes.
     * @param listener - Called with the new config on every `setConfig` or `reset`
     * @returns Unsubscribe function — call it to stop receiving updates
     */
    subscribe(listener: SdkConfigStoreListener): () => void {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },

    /**
     * Returns a named placement from the current config, or `undefined` if not found.
     * @param placementId - The placement identifier as configured in the business dashboard
     */
    getPlacement(placementId: string): ResolvedPlacement | undefined {
        return currentConfig.placements?.[placementId];
    },

    /**
     * `true` once the backend resolve call has completed (successfully or not).
     */
    get isResolved(): boolean {
        return currentConfig.isResolved;
    },

    /**
     * Resets the store to its initial unresolved state and notifies subscribers.
     * Called on client creation and destruction to avoid stale config across
     * re-initializations.
     */
    reset(): void {
        currentConfig = { isResolved: false, merchantId: "" };
        for (const listener of listeners) {
            listener(currentConfig);
        }
        listeners.clear();
    },
};
