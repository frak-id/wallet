import { emitLifecycleEvent } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef } from "react";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

/**
 * Hook to emit redirect with fallback callback support.
 * Listens for deep-link-failed event from parent SDK.
 *
 * Routes deep links through the parent SDK via lifecycle events.
 * The parent handles intent:// conversion and visibility-based
 * fallback detection (fires deep-link-failed when app not found).
 */
export function useDeepLinkFallback() {
    const fallbackRef = useRef<(() => void) | null>(null);

    /**
     * Emit redirect event to parent SDK and register fallback callback.
     * If deep link fails, the registered callback will be executed.
     *
     * All platforms route through parent SDK via postMessage.
     * The parent converts to intent:// on Chromium Android (via
     * window.location.href which Chrome resolves properly, unlike
     * window.open which opens a raw intent:// tab).
     */
    const emitRedirectWithFallback = useCallback(
        (deepLinkUrl: string, onFallback: () => void) => {
            fallbackRef.current = onFallback;

            // Route through parent SDK — it handles intent:// conversion
            // on Chromium Android and visibility-based fallback detection
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
