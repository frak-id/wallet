import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import {
    getOpenSsoLink,
    ssoPopupFeatures,
    ssoPopupName,
} from "@/module/authentication/utils/ssoLink";
import { trackAuthCompleted } from "@/module/common/analytics";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import type { WalletRpcContext } from "@/module/listener/types/context";
import { emitLifecycleEvent } from "@/module/sdk/utils/lifecycleEvents";
import type { SdkSession, Session } from "@/types/Session";
import type { SsoRpcSchema } from "@/types/sso-rpc";
import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    Deferred,
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import type { Hex } from "viem";

type OpenSsoHandler = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_sso",
    WalletRpcContext
>;

type SsoCompleteHandler = RpcPromiseHandler<
    SsoRpcSchema,
    "sso_complete",
    WalletRpcContext
>;

export let pendingSsoRequest: Deferred<{ wallet: Hex }> | undefined = undefined;

export function newPendingSsoRequest(): Deferred<{ wallet: Hex }> {
    pendingSsoRequest = new Deferred();
    return pendingSsoRequest;
}
export function cleanupPendingSsoRequest() {
    pendingSsoRequest = undefined;
}

/**
 * Process SSO completion - shared logic for both RPC and lifecycle handlers
 * Stores session and resolves pending requests
 *
 * @param sessionData - Session data from SSO
 * @param sdkSession - SDK session data
 */
export async function processSsoCompletion(
    sessionData: Session,
    sdkSession: SdkSession
): Promise<void> {
    // Construct full session object
    const session: Session = {
        ...sessionData,
        token: sessionData.token ?? "",
    } as Session;

    try {
        // Save this last authentication
        await jotaiStore.set(addLastAuthenticationAtom, session);

        // Store the session in atoms
        jotaiStore.set(sessionAtom, session);
        jotaiStore.set(sdkSessionAtom, sdkSession);

        // Track successful authentication
        await trackAuthCompleted("sso", session);

        // Resolve pending RPC call if exists
        pendingSsoRequest?.resolve({ wallet: session.address });
        cleanupPendingSsoRequest();

        console.log("[SSO] Authentication completed successfully", {
            address: session.address,
        });
    } catch (error) {
        console.error("[SSO] Error handling completion:", error);

        // Reject pending RPC call on error
        pendingSsoRequest?.reject(
            new FrakRpcError(
                RpcErrorCodes.internalError,
                "Failed to store session after SSO"
            )
        );
        cleanupPendingSsoRequest();

        throw error;
    }
}

/**
 * Handle sso_complete RPC method
 *
 * This is called by the SSO window via RPC instead of custom postMessage.
 * It stores the session and resolves any pending deferred promises.
 *
 * @param params - [session, sdkJwt]
 * @param _context - Request context (unused)
 * @returns Promise resolving to { success: true }
 */
export const handleSsoComplete: SsoCompleteHandler = async (
    params,
    _context
) => {
    const [sessionData, sdkSession] = params;

    await processSsoCompletion(sessionData, sdkSession);

    return { success: true };
};

/**
 * Handle frak_sso RPC method
 *
 * This is called by the SDK to open a SSO window
 *
 * @param params
 * @param context
 * @returns
 */
export const handleOpenSso: OpenSsoHandler = async (params, context) => {
    // Extract request infos
    const ssoInfo = params[0];
    const name = params[1];
    const css = params[2];

    // If we are on the server side directly exit with an error
    if (typeof window === "undefined") {
        throw new FrakRpcError(
            RpcErrorCodes.internalError,
            "Server side not supported"
        );
    }

    // Determine if we should open in same window
    // Default to true if redirectUrl is provided, unless explicitly overridden
    const openInSameWindow = ssoInfo.openInSameWindow ?? ssoInfo.redirectUrl;

    const ssoLink = getOpenSsoLink({
        productId: context.productId,
        metadata: {
            ...ssoInfo.metadata,
            name,
            css,
        },
        directExit: ssoInfo.directExit,
        redirectUrl: ssoInfo.redirectUrl,
        lang: ssoInfo.lang,
    });

    try {
        if (openInSameWindow) {
            // Open in same window - no postMessage flow possible
            // This is used for redirectUrl flows
            emitLifecycleEvent({
                iframeLifecycle: "redirect",
                data: { baseRedirectUrl: ssoLink },
            });
            // Return result with trackingId (wallet will be set later via redirect)
            return { wallet: undefined };
        }

        // Open the popup
        const openedWindow = window.open(
            ssoLink,
            ssoPopupName,
            ssoPopupFeatures
        );

        if (!openedWindow) {
            throw new FrakRpcError(
                RpcErrorCodes.internalError,
                "Failed to open the SSO window"
            );
        }

        openedWindow.focus();

        /**
         * Create Deferred promise that will be resolved by useSsoMessageListener
         * when the SSO window sends postMessage after authentication
         *
         * This eliminates backend polling:
         * - Old: Poll backend every 500ms-2s until session available
         * - New: Wait for direct postMessage from SSO window
         */
        const deferred = newPendingSsoRequest();

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
                pendingSsoRequest?.reject(
                    new FrakRpcError(
                        RpcErrorCodes.clientAborted,
                        "SSO window was closed by user"
                    )
                );
            }
        }, 500);

        // Wait for SSO completion via postMessage
        try {
            const result = await deferred.promise;

            // Cleanup
            clearInterval(windowClosedInterval);
            cleanupPendingSsoRequest();

            return result;
        } catch (error) {
            // Cleanup on error
            clearInterval(windowClosedInterval);
            cleanupPendingSsoRequest();

            throw error;
        }
    } catch (error) {
        console.warn("Unable to open the SSO page", error);

        // If error has code property, throw as-is (already formatted)
        if (error && error instanceof FrakRpcError) {
            throw error;
        }

        // Otherwise wrap in RPC error
        throw new FrakRpcError(
            RpcErrorCodes.internalError,
            "Failed to open the SSO"
        );
    }
};
