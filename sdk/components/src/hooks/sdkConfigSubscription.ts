/**
 * Shared `useSyncExternalStore` plumbing for the SDK config store.
 *
 * The resolved merchant config lives on `window.__frakSdkConfig` and notifies
 * via the `frak:config` CustomEvent (see `@frak-labs/core-sdk` `sdkConfigStore`).
 * A single module-level `subscribe` keeps the reference stable across renders
 * so `useSyncExternalStore` never re-subscribes, and lets every config-driven
 * hook (`useLang`, `usePlacement`, `useGlobalComponents`) share one listener
 * shape instead of each hand-rolling an effect + version counter.
 */

/**
 * Subscribe to resolved-config changes. Stable reference (module-level) so
 * `useSyncExternalStore` treats it as a constant store subscription.
 */
export function subscribeSdkConfig(onStoreChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("frak:config", onStoreChange);
    return () => window.removeEventListener("frak:config", onStoreChange);
}
