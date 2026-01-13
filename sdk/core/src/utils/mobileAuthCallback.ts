import type { RpcClient } from "@frak-labs/frame-connector";
import type { FrakLifecycleEvent, FrakWalletSdkConfig } from "../types";
import type { IFrameRpcSchema } from "../types/rpc";

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
    // Use localStorage because mobile app opens new tab (sessionStorage is per-tab)
    const savedState = localStorage.getItem(AUTH_STATE_KEY);
    if (state && savedState && state !== savedState) {
        cleanupAuthParams(url);
        return;
    }

    // Clean up state from localStorage
    localStorage.removeItem(AUTH_STATE_KEY);

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
        .catch(() => {
            // Silent fail - mobile auth is opportunistic
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
 * Get backend URL from wallet URL
 * Maps wallet URLs to their corresponding backend URLs
 */
function getBackendUrl(walletUrl: string): string {
    // Local development
    if (walletUrl.includes("localhost:3000")) {
        return "http://localhost:3030";
    }
    // Dev environment
    if (
        walletUrl.includes("wallet-dev.frak.id") ||
        walletUrl.includes("wallet.gcp-dev.frak.id")
    ) {
        return "https://backend.gcp-dev.frak.id";
    }
    // Production
    return "https://backend.frak.id";
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
    const backendUrl = getBackendUrl(walletUrl);
    const endpoint = `${backendUrl}/wallet/auth/mobile/exchange`;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authCode, productId }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Exchange failed: ${response.status} - ${errorText}`);
    }

    return response.json();
}
