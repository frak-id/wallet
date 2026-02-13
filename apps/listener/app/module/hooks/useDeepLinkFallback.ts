import {
    isChromiumAndroid,
    isFrakDeepLink,
    toAndroidIntentUrl,
} from "@frak-labs/core-sdk";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef } from "react";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

/**
 * Hook to emit redirect with fallback callback support.
 * Listens for deep-link-failed event from parent SDK.
 *
 * On Chromium Android, triggers the deep link directly from the iframe
 * via window.open() to preserve the user gesture chain. This avoids the
 * "Continue to app?" confirmation bar that Chrome shows when deep links
 * are triggered from a cross-origin postMessage handler.
 */
export function useDeepLinkFallback() {
    const fallbackRef = useRef<(() => void) | null>(null);

    /**
     * Emit redirect event to parent SDK and register fallback callback.
     * If deep link fails, the registered callback will be executed.
     *
     * On Chromium Android: triggers intent:// URL directly from iframe
     * via window.open() (preserves user gesture, no confirmation bar).
     *
     * On other platforms: routes through parent SDK via postMessage
     * (parent handles the navigation).
     */
    const emitRedirectWithFallback = useCallback(
        (deepLinkUrl: string, onFallback: () => void) => {
            fallbackRef.current = onFallback;

            // On Chromium Android, trigger intent URL directly from iframe
            // to preserve user gesture and avoid Chrome's confirmation bar.
            // Keep lifecycle emission so parent fallback contract remains active.
            if (isChromiumAndroid() && isFrakDeepLink(deepLinkUrl)) {
                const intentUrl = toAndroidIntentUrl(deepLinkUrl);
                window.open(intentUrl, "_blank");
            }

            // Route through parent SDK so deep-link-failed can be emitted if needed
            emitLifecycleEvent({
                iframeLifecycle: "redirect",
                data: { baseRedirectUrl: deepLinkUrl },
            });
        },
        []
    );

    // Listen for deep-link-failed from parent SDK
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.clientLifecycle === "deep-link-failed") {
                // Validate the message comes from the expected parent origin
                const expectedOrigin =
                    resolvingContextStore.getState().context?.origin;
                if (expectedOrigin && event.origin !== expectedOrigin) {
                    return;
                }
                fallbackRef.current?.();
                fallbackRef.current = null;
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

    return { emitRedirectWithFallback };
}
