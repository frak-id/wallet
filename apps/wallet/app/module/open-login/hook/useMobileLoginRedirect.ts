import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { sessionStore } from "@frak-labs/wallet-shared";
import { useCallback } from "react";
import type { Hex } from "viem";
import { useGenerateMobileAuthCode } from "./useGenerateMobileAuthCode";

type MobileLoginRedirectParams = {
    returnUrl: string;
    productId: Hex;
    state?: string;
};

/**
 * Hook for mobile auth redirect flow: authenticate -> generate code -> redirect to partner site.
 * Used by /open/login route for OAuth-like authentication on mobile devices.
 */
export function useMobileLoginRedirect() {
    const { generateAuthCode, isGenerating, error } =
        useGenerateMobileAuthCode();

    const executeRedirect = useCallback(
        async ({ returnUrl, productId, state }: MobileLoginRedirectParams) => {
            const session = sessionStore.getState().session;
            if (!session) {
                throw new Error("No active session - user must be logged in");
            }

            const parsedReturnUrl = new URL(returnUrl);
            const returnOrigin = parsedReturnUrl.origin;

            const { authCode } = await generateAuthCode({
                productId,
                returnOrigin,
            });

            const redirectUrl = new URL(returnUrl);
            redirectUrl.searchParams.set("frakAuth", authCode);
            if (state) {
                redirectUrl.searchParams.set("state", state);
            }

            const finalUrl = redirectUrl.toString();
            console.log("[OpenLogin] Redirecting to:", finalUrl);

            if (isTauri()) {
                const { open } = await import("@tauri-apps/plugin-shell");
                await open(finalUrl);
            } else {
                window.location.href = finalUrl;
            }
        },
        [generateAuthCode]
    );

    return {
        executeRedirect,
        isRedirecting: isGenerating,
        error,
    };
}
