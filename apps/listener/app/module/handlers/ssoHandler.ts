import { generateSsoUrl, type IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    Deferred,
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import {
    identifyAuthenticatedUser,
    trackEvent,
} from "@frak-labs/wallet-shared/common/analytics";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/common/utils/lifecycleEvents";
import { addLastAuthentication } from "@frak-labs/wallet-shared/stores/authenticationStore";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import type {
    SdkSession,
    Session,
    SsoRpcSchema,
} from "@frak-labs/wallet-shared/types";
import type { Hex } from "viem";
import type { WalletRpcContext } from "@/module/types/context";

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
let pendingSsoRequest: Deferred<{ wallet: Hex }> | undefined;

/**
 * Store the SSO session and resolve any pending `frak_openSso` request.
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
        await addLastAuthentication(session);

        // Store the session in zustand stores
        sessionStore.getState().setSession(session);
        sessionStore.getState().setSdkSession(sdkSession);

        // Track successful authentication
        identifyAuthenticatedUser(session);
        trackEvent("sso_completed");

        // Resolve pending RPC call if exists
        pendingSsoRequest?.resolve({ wallet: session.address });
        pendingSsoRequest = undefined;
    } catch (error) {
        console.error("[SSO] Error handling completion:", error);
        // Session-persistence failure after a successful SSO round-trip leaves
        // the user in a silently-broken logged-out state. Surface it so the
        // funnel reflects the real outcome.
        const reason =
            error instanceof Error
                ? (error.name ?? "session_persist_failed")
                : "session_persist_failed";
        trackEvent("sso_failed", { reason });
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
 * Handle `sso_complete`, sent by the SSO window once authentication is done.
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
 * Handle `frak_prepareSso` — wallet-side SSO URL generation. Most popup flows
 * generate the URL SDK-side and never reach this handler.
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
        context.merchantId,
        name,
        context.clientId ?? "",
        css
    );

    return Promise.resolve({ ssoUrl });
};

/**
 * Handle `frak_openSso`. In redirect mode the wallet builds the URL and returns
 * `wallet: undefined` immediately; in popup mode the SDK already opened the
 * popup and this handler only waits for `sso_complete`.
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
            context.merchantId,
            name,
            context.clientId ?? "",
            css
        );

        // Flow: wallet iframe -> SDK iframe -> window.location.href = ssoUrl.
        // The URL embeds the clientId and its proof, so only the merchant gets it.
        emitLifecycleEvent(
            { iframeLifecycle: "redirect", data: { baseRedirectUrl: ssoUrl } },
            { targetOrigin: context.origin }
        );

        // Return immediately (wallet will be set after redirect completes)
        return { wallet: undefined };
    }

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
