import { generateSsoUrl, type IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    Deferred,
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import type { Hex } from "viem";
import { addLastAuthenticationAtom } from "@frak-labs/wallet-shared/authentication/atoms/lastAuthenticator";
import { trackAuthCompleted } from "@frak-labs/wallet-shared/common/analytics";
import { sdkSessionAtom, sessionAtom } from "@frak-labs/wallet-shared/common/atoms/session";
import type { WalletRpcContext } from "@/module/types/context";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/sdk/utils/lifecycleEvents";
import type { SdkSession, Session } from "@frak-labs/wallet-shared/types/Session";
import type { SsoRpcSchema } from "@frak-labs/wallet-shared/types/sso-rpc";

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
 * Generates SSO URL server-side (wallet iframe)
 * This is now primarily for backward compatibility or edge cases where
 * client-side generation isn't suitable. Most popup flows use SDK-side generation.
 *
 * @param params - PrepareSsoParamsType
 * @param context
 * @returns {ssoUrl: string}
 *
 * @remarks
 * As of the new architecture, SDK's prepareSso() generates URLs client-side
 * without calling this RPC handler. This handler remains for:
 * - Backward compatibility
 * - Custom wallet-side URL generation logic if needed
 * - Testing/debugging purposes
 */
export const handlePrepareSso: PrepareSsoHandler = (params, context) => {
    // Extract request infos
    const ssoInfo = params[0];
    const name = params[1];
    const css = params[2];

    // Generate SSO URL (same logic as SDK-side generation
    const ssoUrl = generateSsoUrl(
        window.location.origin,
        ssoInfo,
        context.productId,
        name,
        css
    );

    // Return URL
    return Promise.resolve({ ssoUrl });
};

/**
 * Handle frak_openSso RPC method
 *
 * Two execution modes based on openInSameWindow:
 *
 * **Redirect Mode** (openInSameWindow: true):
 * - Wallet generates SSO URL
 * - Triggers redirect via lifecycle event to SDK iframe
 * - Returns immediately with undefined wallet
 * - Wallet address set after redirect completes
 *
 * **Popup Mode** (openInSameWindow: false/omitted):
 * - SDK already opened popup with generated URL (synchronous)
 * - This handler just waits for SSO completion
 * - Returns when popup sends sso_complete message
 *
 * @param params - Full OpenSsoParamsType
 * @param context - Wallet RPC context with productId
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

    // Check if redirect mode (default to true if redirectUrl present)
    const openInSameWindow = ssoInfo.openInSameWindow ?? !!ssoInfo.redirectUrl;

    if (openInSameWindow) {
        // Redirect mode: Generate URL and trigger redirect
        // URL generation must happen wallet-side because only the iframe can trigger redirect
        const ssoUrl = generateSsoUrl(
            window.location.origin,
            ssoInfo,
            context.productId,
            name,
            css
        );

        // Trigger redirect via lifecycle event
        // Flow: wallet iframe -> SDK iframe -> window.location.href = ssoUrl
        emitLifecycleEvent({
            iframeLifecycle: "redirect",
            data: { baseRedirectUrl: ssoUrl },
        });

        // Return immediately (wallet will be set after redirect completes)
        return { wallet: undefined };
    }

    // Popup mode: SDK already opened popup, just wait for completion
    // Note: URL was generated client-side by SDK using generateSsoUrl()
    // Popup is already open at this point (SDK called window.open() before this RPC)

    pendingSsoRequest = new Deferred<{ wallet: Hex }>();

    // Set timeout for SSO completion (120s to account for slow auth flows)
    const timeout = setTimeout(() => {
        if (pendingSsoRequest) {
            pendingSsoRequest.reject(
                new FrakRpcError(
                    RpcErrorCodes.internalError,
                    "SSO timeout - no completion received within 120 seconds"
                )
            );
            pendingSsoRequest = undefined;
        }
    }, 120_000);

    try {
        // Wait for SSO completion
        // Resolved by processSsoCompletion() when SSO page sends sso_complete message
        const result = await pendingSsoRequest.promise;
        clearTimeout(timeout);
        return result;
    } catch (error) {
        clearTimeout(timeout);

        // If error is already formatted, throw as-is
        if (error instanceof FrakRpcError) {
            throw error;
        }

        // Otherwise wrap in RPC error
        throw new FrakRpcError(RpcErrorCodes.internalError, "SSO failed");
    }
};
