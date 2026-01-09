import type { RpcClient } from "@frak-labs/frame-connector";
import type { FrakLifecycleEvent, FrakWalletSdkConfig } from "../types";
import type { IFrameRpcSchema } from "../types/rpc";

/**
 * Result of processing a mobile auth callback
 */
export type MobileAuthCallbackResult = {
    success: boolean;
    wallet?: string;
    error?: string;
};

/**
 * State stored in sessionStorage for CSRF protection
 */
const AUTH_STATE_KEY = "frak_auth_state";

/**
 * Listen for mobile auth redirect with auth code in URL
 * Exchanges auth code for session and forwards to iframe
 * Cleans URL immediately after detection
 *
 * @param config - SDK configuration (for walletUrl)
 * @param rpcClient - RPC client instance to send lifecycle events
 * @param waitForConnection - Promise that resolves when iframe is connected
 */
export function setupMobileAuthCallback(
    config: FrakWalletSdkConfig,
    rpcClient: RpcClient<IFrameRpcSchema, FrakLifecycleEvent>,
    waitForConnection: Promise<boolean>
): void {
    if (typeof window === "undefined") {
        return;
    }

    // One-shot URL check
    const url = new URL(window.location.href);
    const authCode = url.searchParams.get("frakAuth");
    const productId = url.searchParams.get("productId");
    const state = url.searchParams.get("state");

    // Early return if no auth callback params
    if (!authCode || !productId) {
        return;
    }

    // Validate state to prevent CSRF attacks
    const savedState = sessionStorage.getItem(AUTH_STATE_KEY);
    if (state && savedState && state !== savedState) {
        console.error("[Frak SDK] Mobile auth callback state mismatch");
        cleanupAuthParams(url);
        return;
    }

    // Clean up state from sessionStorage
    sessionStorage.removeItem(AUTH_STATE_KEY);

    // Clean URL immediately to prevent exposure in browser history
    cleanupAuthParams(url);

    // Exchange auth code for session
    const walletUrl = config.walletUrl ?? "https://wallet.frak.id";

    exchangeAuthCode({ walletUrl, authCode, productId })
        .then(async (result) => {
            // Wait for iframe connection before sending lifecycle event
            await waitForConnection;

            // Send lifecycle event with session data
            rpcClient.sendLifecycle({
                clientLifecycle: "mobile-auth-complete",
                data: {
                    wallet: result.wallet,
                    sdkJwt: result.sdkJwt,
                },
            });
        })
        .catch((error) => {
            console.error(
                "[Frak SDK] Failed to exchange mobile auth code:",
                error
            );
        });
}

/**
 * Remove auth params from URL without page reload
 */
function cleanupAuthParams(url: URL): void {
    url.searchParams.delete("frakAuth");
    url.searchParams.delete("productId");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
}

/**
 * Exchange auth code with backend for session
 */
async function exchangeAuthCode({
    walletUrl,
    authCode,
    productId,
}: {
    walletUrl: string;
    authCode: string;
    productId: string;
}): Promise<{
    wallet: string;
    sdkJwt: { token: string; expires: number };
}> {
    const response = await fetch(
        `${walletUrl}/api/wallet/auth/mobile/exchange`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authCode, productId }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Exchange failed: ${response.status} - ${errorText}`);
    }

    return response.json();
}
