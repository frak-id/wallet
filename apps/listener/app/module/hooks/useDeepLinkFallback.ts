import { emitLifecycleEvent } from "@frak-labs/wallet-shared/common/utils/lifecycleEvents";
import { useCallback, useEffect, useRef } from "react";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

/**
 * Emit a deep-link redirect through the parent SDK, with a fallback callback
 * run when the parent reports `deep-link-failed`.
 */
export function useDeepLinkFallback() {
    const fallbackRef = useRef<(() => void) | null>(null);

    const emitRedirectWithFallback = useCallback(
        (deepLinkUrl: string, onFallback: () => void) => {
            fallbackRef.current = onFallback;

            // The parent handles intent:// conversion on Chromium Android (via
            // `window.location.href`, which `window.open` gets wrong) and
            // visibility-based fallback detection. The pairing id in the URL
            // is only for the merchant, so an unresolved origin sends nothing.
            const origin = resolvingContextStore.getState().context?.origin;
            if (!origin) {
                console.warn(
                    "[DeepLink] Origin not resolved, redirect dropped"
                );
                return;
            }
            emitLifecycleEvent(
                {
                    iframeLifecycle: "redirect",
                    data: { baseRedirectUrl: deepLinkUrl },
                },
                { targetOrigin: origin }
            );
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
