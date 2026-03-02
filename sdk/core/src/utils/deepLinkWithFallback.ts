import { DEEP_LINK_SCHEME } from "./constants";

/**
 * Options for deep link with fallback
 */
export type DeepLinkFallbackOptions = {
    /** Timeout in ms before triggering fallback (default: 2500ms) */
    timeout?: number;
    /** Callback invoked when fallback is triggered (app not installed) */
    onFallback?: () => void;
};

/**
 * Check if running on a Chromium-based Android browser.
 *
 * On Chrome Android, custom scheme deep links (e.g. frakwallet://) trigger
 * a confirmation bar ("Continue to Frak Wallet?"). Using intent:// URLs
 * instead bypasses this for Chromium browsers while keeping custom scheme
 * fallback for non-Chromium browsers (e.g. Firefox) where it works fine.
 */
export function isChromiumAndroid(): boolean {
    const ua = navigator.userAgent;
    return /Android/i.test(ua) && /Chrome\/\d+/i.test(ua);
}

/**
 * Convert a frakwallet:// deep link to an Android intent:// URL.
 *
 * Intent URLs let Chromium browsers open the app directly without
 * showing the "Continue to app?" confirmation bar.
 *
 * Note: We intentionally omit the `package` parameter. Including it
 * causes Chrome to redirect to the Play Store when the app is not
 * installed, which breaks the visibility-based fallback detection.
 * Without `package`, Chrome simply does nothing when the app is
 * missing, allowing the fallback mechanism to fire correctly.
 *
 * Format: intent://path#Intent;scheme=frakwallet;end
 */
export function toAndroidIntentUrl(deepLink: string): string {
    // Extract everything after "frakwallet://"
    const path = deepLink.slice(DEEP_LINK_SCHEME.length);
    return `intent://${path}#Intent;scheme=frakwallet;end`;
}

/**
 * Trigger a deep link with visibility-based fallback detection.
 *
 * Uses the Page Visibility API to detect if the app opened (page goes hidden).
 * If the page remains visible after the timeout, assumes app is not installed
 * and invokes the onFallback callback.
 *
 * On Chromium Android, converts custom scheme to intent:// URL to avoid
 * the "Continue to app?" confirmation bar.
 *
 * @param deepLink - The deep link URL to trigger (e.g., "frakwallet://wallet")
 * @param options - Optional configuration (timeout, onFallback callback)
 */
export function triggerDeepLinkWithFallback(
    deepLink: string,
    options?: DeepLinkFallbackOptions
): void {
    const timeout = options?.timeout ?? 2500;

    // Track if the app opened (page went to background)
    let appOpened = false;

    const onVisibilityChange = () => {
        if (document.hidden) {
            appOpened = true;
        }
    };

    // Start listening for visibility changes
    document.addEventListener("visibilitychange", onVisibilityChange);

    // On Chromium Android, use intent:// to avoid confirmation bar
    const url =
        isChromiumAndroid() && isFrakDeepLink(deepLink)
            ? toAndroidIntentUrl(deepLink)
            : deepLink;

    // Trigger the deep link
    window.location.href = url;

    // Check after timeout if app opened
    setTimeout(() => {
        // Clean up listener
        document.removeEventListener("visibilitychange", onVisibilityChange);

        if (!appOpened) {
            // App didn't open - trigger fallback callback
            options?.onFallback?.();
        }
    }, timeout);
}

/**
 * Check if a URL is a Frak deep link
 */
export function isFrakDeepLink(url: string): boolean {
    return url.startsWith(DEEP_LINK_SCHEME);
}
