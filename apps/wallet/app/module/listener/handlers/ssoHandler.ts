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

type PrepareSsoHandler = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_prepareSso",
    WalletRpcContext
>;

type OpenSsoHandler = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_openSso",
    WalletRpcContext
>;

type SsoCompleteHandler = RpcPromiseHandler<
    SsoRpcSchema,
    "sso_complete",
    WalletRpcContext
>;

/**
 * Pending SSO request - stores deferred promise waiting for completion
 */
export let pendingSsoRequest: Deferred<{ wallet: Hex }> | undefined = undefined;

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
        pendingSsoRequest = undefined;

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
        pendingSsoRequest = undefined;

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
 * Handle frak_prepareSso RPC method
 *
 * Generates SSO URL for popup opening
 * Only called for popup flows (not redirect flows)
 *
 * @param params - PrepareSsoParamsType (no openInSameWindow)
 * @param context
 * @returns {ssoUrl: string}
 */
export const handlePrepareSso: PrepareSsoHandler = (params, context) => {
    // Extract request infos
    const ssoInfo = params[0];
    const name = params[1];
    const css = params[2];

    // Generate SSO URL
    const ssoUrl = getOpenSsoLink({
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

    // Return URL for SDK to open in popup
    return Promise.resolve({ ssoUrl });
};

/**
 * Handle frak_openSso RPC method
 *
 * Handles BOTH redirect and popup flows:
 * - Redirect mode: Generates URL and triggers redirect via lifecycle event
 * - Popup mode: Waits for popup completion via sso_complete
 *
 * @param params - Full OpenSsoParamsType (with openInSameWindow)
 * @param context
 * @returns Promise<{wallet: Hex | undefined}>
 */
export const handleOpenSso: OpenSsoHandler = async (params, context) => {
    // If we are on the server side directly exit with an error
    if (typeof window === "undefined") {
        throw new FrakRpcError(
            RpcErrorCodes.internalError,
            "Server side not supported"
        );
    }

    // Extract request infos
    const ssoInfo = params[0];
    const name = params[1];
    const css = params[2];

    // Check if redirect mode
    const openInSameWindow = ssoInfo.openInSameWindow;
    if (openInSameWindow) {
        // Generate SSO URL (needed for both modes)
        const ssoUrl = getOpenSsoLink({
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
        // Trigger redirect via lifecycle event
        // This causes: wallet iframe -> SDK iframe -> redirect to SSO page
        emitLifecycleEvent({
            iframeLifecycle: "redirect",
            data: { baseRedirectUrl: ssoUrl },
        });
        // Return with undefined wallet (will be set after redirect completes)
        return { wallet: undefined };
    }

    // Popup mode: wait for SSO completion
    pendingSsoRequest = new Deferred<{ wallet: Hex }>();

    // Set timeout for SSO completion
    const timeout = setTimeout(() => {
        if (pendingSsoRequest) {
            pendingSsoRequest.reject(
                new FrakRpcError(
                    RpcErrorCodes.internalError,
                    "SSO timeout - no completion received within 60 seconds"
                )
            );
            pendingSsoRequest = undefined;
        }
    }, 120_000); // 120 second timeout

    try {
        // Wait for SSO completion (resolved by processSsoCompletion when popup sends sso_complete)
        const result = await pendingSsoRequest.promise;
        clearTimeout(timeout);
        return result;
    } catch (error) {
        clearTimeout(timeout);

        // If error has code property, throw as-is (already formatted)
        if (error && error instanceof FrakRpcError) {
            throw error;
        }

        // Otherwise wrap in RPC error
        throw new FrakRpcError(RpcErrorCodes.internalError, "SSO failed");
    }
};
