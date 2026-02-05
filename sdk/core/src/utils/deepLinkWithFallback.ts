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
 * Trigger a deep link with visibility-based fallback detection.
 *
 * Uses the Page Visibility API to detect if the app opened (page goes hidden).
 * If the page remains visible after the timeout, assumes app is not installed
 * and invokes the onFallback callback.
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

    // Trigger the deep link
    window.location.href = deepLink;

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
