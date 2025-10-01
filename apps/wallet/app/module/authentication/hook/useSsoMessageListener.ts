import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import type { Session } from "@/types/Session";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { useCallback, useEffect } from "react";
import type { Hex } from "viem";
import { trackAuthCompleted, trackAuthFailed } from "../../common/analytics";

/**
 * Message format sent from SSO window to wallet iframe
 */
type SsoCompletionMessage = {
    type: "sso-complete";
    payload: {
        session: Omit<Session, "token"> & { token?: string };
        sdkJwt: string;
        ssoId?: Hex;
    };
};

type SsoErrorMessage = {
    type: "sso-error";
    payload: {
        error: string;
        ssoId?: Hex;
    };
};

type SsoWindowMessage = SsoCompletionMessage | SsoErrorMessage;

/**
 * Global registry to track pending SSO deferred promises
 * - Key: ssoId (tracking ID)
 * - Value: Deferred-like object with resolve/reject
 *
 * Performance rationale:
 * - Uses Map for O(1) lookup by ssoId
 * - Stored at module level to survive component re-renders
 * - Cleaned up after resolution to prevent memory leaks
 */
const pendingSsoRequests = new Map<
    string,
    {
        resolve: (value: { wallet: Hex }) => void;
        reject: (error: { code: number; message: string }) => void;
    }
>();

/**
 * Register a pending SSO request
 * @param ssoId - The SSO tracking ID
 * @param deferred - The deferred promise resolver
 */
export function registerPendingSsoRequest(
    ssoId: string,
    deferred: {
        resolve: (value: { wallet: Hex }) => void;
        reject: (error: { code: number; message: string }) => void;
    }
) {
    pendingSsoRequests.set(ssoId, deferred);
}

/**
 * Unregister a pending SSO request
 * @param ssoId - The SSO tracking ID
 */
export function unregisterPendingSsoRequest(ssoId: string) {
    pendingSsoRequests.delete(ssoId);
}

/**
 * Hook that listens for postMessage from SSO windows
 *
 * Performance considerations:
 * - Single global listener instead of per-component listeners
 * - Origin validation prevents security vulnerabilities
 * - Message handling is synchronous to minimize latency
 * - Cleanup on unmount to prevent memory leaks
 *
 * Flow:
 * 1. SSO window completes authentication
 * 2. SSO window sends postMessage to window.opener (wallet iframe)
 * 3. This listener validates origin and message type
 * 4. Stores session in sessionAtom and sdkSessionAtom
 * 5. Resolves pending deferred with wallet address
 * 6. RPC call returns success to SDK
 */
export function useSsoMessageListener() {
    const handleMessage = useCallback(
        (event: MessageEvent<SsoWindowMessage>) => {
            // Security: Validate origin is from our own domain
            // This prevents XSS attacks from malicious windows
            const expectedOrigin = window.location.origin;
            if (event.origin !== expectedOrigin) {
                console.warn(
                    "[SSO] Rejected message from invalid origin:",
                    event.origin
                );
                return;
            }

            // Type guard: Ensure message has expected structure
            if (
                !event.data ||
                typeof event.data !== "object" ||
                !("type" in event.data)
            ) {
                return;
            }

            const message = event.data;

            // Handle SSO completion
            if (message.type === "sso-complete") {
                handleSsoComplete(message.payload);
                return;
            }

            // Handle SSO error
            if (message.type === "sso-error") {
                handleSsoError(message.payload);
                return;
            }
        },
        []
    );

    /**
     * Handle successful SSO completion
     * - Stores session in atoms
     * - Tracks analytics event
     * - Resolves pending deferred
     */
    const handleSsoComplete = useCallback(
        async (payload: SsoCompletionMessage["payload"]) => {
            const { session: sessionData, sdkJwt, ssoId } = payload;

            // Construct full session object
            const session: Session = {
                ...sessionData,
                token: sessionData.token ?? "",
            } as Session;

            try {
                // Save this last authentication
                await jotaiStore.set(addLastAuthenticationAtom, session);

                // Store the session in atoms
                // This triggers re-renders in components watching these atoms
                jotaiStore.set(sessionAtom, session);
                jotaiStore.set(sdkSessionAtom, {
                    token: sdkJwt,
                    expires: Date.now() + 24 * 60 * 60 * 1000, // 24h default
                });

                // Track successful authentication
                await trackAuthCompleted("sso", session, {
                    ssoId: ssoId,
                });

                // Resolve pending RPC call if exists
                if (ssoId) {
                    const deferred = pendingSsoRequests.get(ssoId);
                    if (deferred) {
                        deferred.resolve({ wallet: session.address });
                        unregisterPendingSsoRequest(ssoId);
                    }
                }

                console.log("[SSO] Authentication completed successfully", {
                    address: session.address,
                    ssoId,
                });
            } catch (error) {
                console.error("[SSO] Error handling completion:", error);

                // Reject pending RPC call on error
                if (ssoId) {
                    const deferred = pendingSsoRequests.get(ssoId);
                    if (deferred) {
                        deferred.reject({
                            code: -32603,
                            message: "Failed to store session after SSO",
                        });
                        unregisterPendingSsoRequest(ssoId);
                    }
                }
            }
        },
        []
    );

    /**
     * Handle SSO error
     * - Tracks analytics event
     * - Rejects pending deferred
     */
    const handleSsoError = useCallback(
        async (payload: SsoErrorMessage["payload"]) => {
            const { error, ssoId } = payload;

            // Track failed authentication
            await trackAuthFailed("sso", error, {
                ssoId: ssoId,
            });

            // Reject pending RPC call if exists
            if (ssoId) {
                const deferred = pendingSsoRequests.get(ssoId);
                if (deferred) {
                    deferred.reject({
                        code: -32603,
                        message: error || "SSO authentication failed",
                    });
                    unregisterPendingSsoRequest(ssoId);
                }
            }

            console.error("[SSO] Authentication failed:", error, { ssoId });
        },
        []
    );

    /**
     * Setup message listener on mount
     * Cleanup on unmount to prevent memory leaks
     */
    useEffect(() => {
        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("message", handleMessage);
        };
    }, [handleMessage]);
}
