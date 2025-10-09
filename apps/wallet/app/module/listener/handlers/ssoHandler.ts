import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { getOpenSsoLink } from "@/module/authentication/utils/ssoLink";
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
let ssoPopupWindow: Window | null = null;

export function newPendingSsoRequest(): Deferred<{ wallet: Hex }> {
    pendingSsoRequest = new Deferred();
    return pendingSsoRequest;
}

export function cleanupPendingSsoRequest() {
    pendingSsoRequest = undefined;
}

export function setSsoPopupWindow(popup: Window | null) {
    ssoPopupWindow = popup;
}

export function getSsoPopupWindow(): Window | null {
    return ssoPopupWindow;
}

/**
 * Handle postMessage from SSO popup window
 * This is called by the global message listener in listener.tsx
 */
export function handleSsoPopupMessage(event: MessageEvent): void {
    if (event.data?.type === "sso_popup_ready") {
        setSsoPopupWindow(event.source as Window);
    } else if (event.data?.type === "sso_popup_closed") {
        setSsoPopupWindow(null);

        // Reject pending request if exists
        if (pendingSsoRequest) {
            pendingSsoRequest.reject(
                new FrakRpcError(
                    RpcErrorCodes.clientAborted,
                    "SSO window was closed by user"
                )
            );
            cleanupPendingSsoRequest();
        }
    }
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

        const deferred = newPendingSsoRequest();
        let checkInterval: NodeJS.Timeout | undefined = undefined;
        let timeout: NodeJS.Timeout | undefined = undefined;

        const cleanup = () => {
            if (checkInterval) clearInterval(checkInterval);
            if (timeout) clearTimeout(timeout);
            setSsoPopupWindow(null);
            cleanupPendingSsoRequest();
        };

        const sendUrlWhenReady = () => {
            if (ssoPopupWindow) {
                ssoPopupWindow.postMessage(
                    { type: "sso_url", url: ssoLink },
                    window.location.origin
                );
                // Clear polling/timeout after sending URL
                if (checkInterval) clearInterval(checkInterval);
                if (timeout) clearTimeout(timeout);
                checkInterval = undefined;
                timeout = undefined;
                // Clear popup reference since it will navigate away
                setSsoPopupWindow(null);
            }
        };

        // Try to send immediately if popup is already ready
        if (ssoPopupWindow) {
            sendUrlWhenReady();
        } else {
            // Poll for popup reference (set by global listener)
            checkInterval = setInterval(sendUrlWhenReady, 200);

            // Timeout if popup never becomes ready
            // Note: Error is thrown to SDK caller - integrators can implement retry logic if needed
            timeout = setTimeout(() => {
                cleanup();
                pendingSsoRequest?.reject(
                    new FrakRpcError(
                        RpcErrorCodes.internalError,
                        "SSO popup failed to establish communication"
                    )
                );
            }, 10000);
        }

        // Wait for SSO completion
        try {
            const result = await deferred.promise;
            cleanup();
            return result;
        } catch (error) {
            cleanup();
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
