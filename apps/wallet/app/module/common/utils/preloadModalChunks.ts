/**
 * Pre-warm the module graph for modal-only lazy chunks during browser idle time.
 *
 * `ModalOutlet` (`@/module/common/component/ModalOutlet`) lazy-loads heavy
 * modals via `React.lazy(() => import(...))`. Without preloading, the user
 * pays a round-trip on first modal open. Triggering the same `import()` calls
 * after first paint, gated by `requestIdleCallback`, lets the browser fetch
 * the chunks in the background while the main thread is otherwise idle.
 *
 * Route-level chunks are already pre-warmed by TanStack Router's
 * `defaultPreload: "render"` (see `main.tsx`) — so this only covers the gap
 * left by modal-triggered React.lazy chunks.
 *
 * Vite/Rolldown caches the dynamic-import promise, so calling these here is
 * cheap; when the modal actually opens, `React.lazy` resolves synchronously
 * from the in-flight or settled promise.
 */
export function preloadModalChunks() {
    // Auth/recovery — Keypass fires on login + post-onboarding flows
    void import("@/module/onboarding/component/Keypass");
    // Wallet shell extras
    void import("@/module/wallet/component/WelcomeCard/WelcomeDetail");
    void import("@/module/tokens/component/PendingGainsModal");
    // Lazy modals from feature-* chunks
    void import("@/module/history/component/RewardDetailModal");
    void import("@/module/history/component/MoneriumOrderDetailModal");
    void import("@/module/explorer/component/ExplorerDetail");
    void import("@/module/referral/component/EditReferralCodeSheet");
    void import("@/module/monerium/component/MoneriumBankFlow");
}

/**
 * Schedule `preloadModalChunks` on the next browser idle tick after first
 * paint. Falls back to a 1.5 s timeout in environments without
 * `requestIdleCallback` (Safari < 18). The 2 s `timeout` upper bound ensures
 * preload still fires on busy main threads (e.g. heavy hydration).
 *
 * Returns a cleanup function suitable for `useEffect`'s teardown so React
 * Strict Mode double-invocations and unmount-during-idle don't double-fire.
 */
export function scheduleIdleModalPreload(): () => void {
    if (typeof window === "undefined") return () => {};

    if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(() => preloadModalChunks(), {
            timeout: 2000,
        });
        return () => window.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(() => preloadModalChunks(), 1500);
    return () => window.clearTimeout(handle);
}
