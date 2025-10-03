import type { createRpcClient } from "@frak-labs/rpc";
import type { IFrameRpcSchema } from "../types/rpc";

/**
 * Listen for SSO redirect with compressed data in URL
 * Forwards compressed data to iframe via lifecycle event
 * Cleans URL immediately after detection
 *
 * Performance: One-shot URL check, no polling, no re-renders
 *
 * @param rpcClient - RPC client instance to send lifecycle events
 * @param waitForConnection - Promise that resolves when iframe is connected
 */
export function setupSsoUrlListener(
    rpcClient: ReturnType<typeof createRpcClient<IFrameRpcSchema>>,
    waitForConnection: Promise<boolean>
): void {
    if (typeof window === "undefined") {
        return;
    }

    // One-shot URL check - no need for MutationObserver or polling
    const url = new URL(window.location.href);
    const compressedSso = url.searchParams.get("sso");

    // Early return if no SSO parameter
    if (!compressedSso) {
        return;
    }

    // Forward compressed data directly to iframe (no decompression on SDK side)
    // Iframe will decompress and process
    waitForConnection
        .then(() => {
            // Send lifecycle event with compressed string
            // This is a one-way notification, no response expected
            rpcClient.sendLifecycle({
                clientLifecycle: "sso-redirect-complete",
                data: { compressed: compressedSso },
            });

            console.log(
                "[SSO URL Listener] Forwarded compressed SSO data to iframe"
            );
        })
        .catch((error) => {
            console.error(
                "[SSO URL Listener] Failed to forward SSO data:",
                error
            );
        });

    // Clean URL immediately to prevent exposure in browser history
    // Use replaceState to avoid navigation/re-render
    url.searchParams.delete("sso");
    window.history.replaceState({}, "", url.toString());

    console.log("[SSO URL Listener] SSO parameter detected and URL cleaned");
}
