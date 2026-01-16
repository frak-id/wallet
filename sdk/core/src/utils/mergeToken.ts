import type { FrakWalletSdkConfig } from "../types/config";
import { getBackendUrl } from "./backendUrl";
import { getClientId } from "./clientId";
import { resolveMerchantId } from "./merchantId";

/**
 * Generate a merge token from the backend for identity merge
 *
 * @param config - SDK configuration
 * @returns Merge token string or undefined if generation fails
 */
export async function generateMergeToken(
    config: FrakWalletSdkConfig
): Promise<string | undefined> {
    if (typeof window === "undefined") {
        return undefined;
    }

    try {
        const sourceAnonymousId = getClientId();
        const merchantId = await resolveMerchantId(config, config.walletUrl);

        if (!merchantId) {
            console.warn(
                "[Frak SDK] Cannot generate merge token: merchantId not available"
            );
            return undefined;
        }

        console.log("[Frak SDK] Generating merge token with:", {
            sourceAnonymousId,
            merchantId,
        });

        const backendUrl = getBackendUrl(config.walletUrl);
        const response = await fetch(
            `${backendUrl}/user/identity/merge/initiate`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sourceAnonymousId,
                    merchantId,
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn(
                "[Frak SDK] Failed to generate merge token:",
                response.status,
                errorData
            );
            return undefined;
        }

        const data = (await response.json()) as {
            mergeToken: string;
            expiresAt: string;
        };
        return data.mergeToken;
    } catch (error) {
        console.warn("[Frak SDK] Error generating merge token:", error);
        return undefined;
    }
}

/**
 * Generate merge token and redirect to target URL with token appended
 *
 * @param targetUrl - URL to redirect to
 * @param config - SDK configuration
 */
export async function redirectWithMerge(
    targetUrl: string,
    config: FrakWalletSdkConfig
): Promise<void> {
    if (typeof window === "undefined") {
        return;
    }

    try {
        // Generate merge token
        const mergeToken = await generateMergeToken(config);

        if (!mergeToken) {
            console.warn(
                "[Frak SDK] Cannot redirect with merge: token generation failed"
            );
            return;
        }

        // Append token to URL
        const url = new URL(targetUrl);
        url.searchParams.set("fmt", mergeToken);

        // Redirect
        window.location.assign(url.toString());
    } catch (error) {
        console.warn("[Frak SDK] Error in redirectWithMerge:", error);
    }
}

/**
 * Setup listener for merge token in URL
 * Detects ?fmt= parameter, executes merge, and cleans URL
 *
 * @param config - SDK configuration
 * @param waitForConnection - Optional promise to wait for connection before executing merge
 */
export function setupMergeTokenListener(
    config: FrakWalletSdkConfig,
    waitForConnection?: Promise<boolean>
): void {
    if (typeof window === "undefined") {
        return;
    }

    // One-shot URL check
    const url = new URL(window.location.href);
    const mergeToken = url.searchParams.get("fmt");

    // Early return if no merge token parameter
    if (!mergeToken) {
        return;
    }

    // Clean URL immediately to prevent exposure in browser history
    // Use replaceState to avoid navigation/re-render
    url.searchParams.delete("fmt");
    window.history.replaceState({}, "", url.toString());

    console.log("[Frak SDK] Merge token detected and URL cleaned");

    // Execute merge in background (fire-and-forget)
    executeMergeInternal(mergeToken, config, waitForConnection).catch(
        (error) => {
            console.warn("[Frak SDK] Failed to execute merge:", error);
        }
    );
}

/**
 * Internal helper to execute merge with backend
 *
 * @param mergeToken - JWT merge token from URL
 * @param config - SDK configuration
 * @param waitForConnection - Optional promise to wait for connection
 */
async function executeMergeInternal(
    mergeToken: string,
    config: FrakWalletSdkConfig,
    waitForConnection?: Promise<boolean>
): Promise<void> {
    try {
        // Wait for connection if provided
        if (waitForConnection) {
            await waitForConnection;
        }

        // Get required data
        const targetAnonymousId = getClientId();
        const merchantId = await resolveMerchantId(config, config.walletUrl);

        if (!merchantId) {
            console.warn(
                "[Frak SDK] Cannot execute merge: merchantId not available"
            );
            return;
        }

        // Call backend to execute merge
        const backendUrl = getBackendUrl(config.walletUrl);
        const response = await fetch(
            `${backendUrl}/user/identity/merge/execute`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    mergeToken,
                    targetAnonymousId,
                    merchantId,
                }),
            }
        );

        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as {
                error?: string;
            };
            console.warn(
                "[Frak SDK] Merge execution failed:",
                response.status,
                errorData.error || "Unknown error"
            );
            return;
        }

        const data = (await response.json()) as {
            success: boolean;
            finalGroupId: string;
            merged: boolean;
        };

        if (data.success) {
            console.log(
                "[Frak SDK] Identity merge completed:",
                data.merged ? "merged" : "already in same group"
            );
        }
    } catch (error) {
        console.warn("[Frak SDK] Error executing merge:", error);
    }
}
