import {
    ssoPopupFeatures,
    ssoPopupName,
    useGetOpenSsoLink,
} from "@/module/authentication/hook/useGetOpenSsoLink";
import {
    registerPendingSsoRequest,
    unregisterPendingSsoRequest,
} from "@/module/listener/handlers/customMessageHandler";
import type { WalletRpcContext } from "@/module/listener/types/context";
import { Deferred, type IFrameRpcSchema } from "@frak-labs/core-sdk";
import { RpcErrorCodes } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/rpc";
import { useCallback, useEffect, useRef } from "react";
import type { Hex } from "viem";

type OnOpenSso = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_sso",
    WalletRpcContext
>;

/**
 * Hook use to listen to the wallet status
 *
 * Note: Context is augmented by middleware with productId, sourceUrl, etc.
 *
 * Performance considerations:
 * - Uses Deferred pattern to avoid backend polling
 * - Window is opened immediately for user action (no async delay)
 * - Promise resolves only when SSO window sends postMessage
 * - Cleanup on unmount prevents memory leaks
 *
 * Flow:
 * 1. SDK calls frak_sso RPC method
 * 2. This hook opens SSO window with trackingId
 * 3. Creates Deferred promise and registers it globally
 * 4. Returns promise (doesn't resolve immediately)
 * 5. SSO page completes auth and sends postMessage
 * 6. useSsoMessageListener receives message and resolves deferred
 * 7. This RPC call finally returns to SDK with wallet address
 */
export function useOnOpenSso(): OnOpenSso {
    const getOpenSsoLink = useGetOpenSsoLink();

    // Track pending requests for cleanup
    const pendingRequestsRef = useRef<Set<string>>(new Set());

    /**
     * Cleanup on unmount: reject all pending SSO requests
     * This prevents memory leaks if component unmounts during SSO flow
     */
    useEffect(() => {
        return () => {
            for (const ssoId of pendingRequestsRef.current) {
                unregisterPendingSsoRequest(ssoId);
            }
            pendingRequestsRef.current.clear();
        };
    }, []);

    return useCallback(
        async (params, context) => {
            // Extract request infos
            const ssoInfo = params[0];
            const name = params[1];
            const css = params[2];

            // If we are on the server side directly exit with an error
            if (typeof window === "undefined") {
                throw {
                    code: RpcErrorCodes.internalError,
                    message: "Server side not supported",
                };
            }

            // Determine if we should open in same window
            // Default to true if redirectUrl is provided, unless explicitly overridden
            const openInSameWindow =
                ssoInfo.openInSameWindow ?? ssoInfo.redirectUrl;

            const { url: ssoLink, trackingId } = await getOpenSsoLink({
                productId: context.productId,
                metadata: {
                    ...ssoInfo.metadata,
                    name,
                    css,
                },
                directExit: ssoInfo.directExit,
                redirectUrl: ssoInfo.redirectUrl,
                consumeKey: ssoInfo.consumeKey,
                lang: ssoInfo.lang,
            });

            try {
                if (openInSameWindow) {
                    // Open in same window - no postMessage flow possible
                    // This is used for redirectUrl flows
                    window.location.href = ssoLink;
                    // Return result with trackingId (wallet will be set later via redirect)
                    return { trackingId, wallet: undefined };
                }

                // Open the popup
                const openedWindow = window.open(
                    ssoLink,
                    ssoPopupName,
                    ssoPopupFeatures
                );

                if (!openedWindow) {
                    throw {
                        code: RpcErrorCodes.internalError,
                        message: "Failed to open the SSO window",
                    };
                }

                openedWindow.focus();

                // If no trackingId, return immediately (backward compatibility)
                if (!trackingId) {
                    return { trackingId, wallet: undefined };
                }

                /**
                 * Create Deferred promise that will be resolved by useSsoMessageListener
                 * when the SSO window sends postMessage after authentication
                 *
                 * This eliminates backend polling:
                 * - Old: Poll backend every 500ms-2s until session available
                 * - New: Wait for direct postMessage from SSO window
                 */
                const deferred = new Deferred<{
                    wallet: Hex;
                    trackingId?: Hex;
                }>();

                // Register this deferred globally so useSsoMessageListener can resolve it
                registerPendingSsoRequest(trackingId, {
                    resolve: (value: { wallet: Hex }) =>
                        deferred.resolve({ ...value, trackingId }),
                    reject: deferred.reject.bind(deferred),
                });

                // Track for cleanup
                pendingRequestsRef.current.add(trackingId);

                /**
                 * Monitor window closure
                 * If user closes SSO window without completing, reject the promise
                 *
                 * Performance note: setInterval is acceptable here as:
                 * - Only runs during active SSO flow (short-lived)
                 * - 500ms interval is low frequency
                 * - Cleaned up immediately on window close or completion
                 */
                const windowClosedInterval = setInterval(() => {
                    if (openedWindow.closed) {
                        clearInterval(windowClosedInterval);

                        // Check if deferred is still pending
                        if (pendingRequestsRef.current.has(trackingId)) {
                            deferred.reject({
                                code: RpcErrorCodes.clientAborted,
                                message: "SSO window was closed by user",
                            });
                            unregisterPendingSsoRequest(trackingId);
                            pendingRequestsRef.current.delete(trackingId);
                        }
                    }
                }, 500);

                // Wait for SSO completion via postMessage
                try {
                    const result = await deferred.promise;

                    // Cleanup
                    clearInterval(windowClosedInterval);
                    pendingRequestsRef.current.delete(trackingId);

                    return result;
                } catch (error) {
                    // Cleanup on error
                    clearInterval(windowClosedInterval);
                    unregisterPendingSsoRequest(trackingId);
                    pendingRequestsRef.current.delete(trackingId);

                    throw error;
                }
            } catch (error) {
                console.warn("Unable to open the SSO page", error);

                // If error has code property, throw as-is (already formatted)
                if (error && typeof error === "object" && "code" in error) {
                    throw error;
                }

                // Otherwise wrap in RPC error
                throw {
                    code: RpcErrorCodes.internalError,
                    message: "Failed to open the SSO",
                };
            }
        },
        [getOpenSsoLink]
    );
}
