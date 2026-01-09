import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { sessionStore } from "@frak-labs/wallet-shared";
import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { useGenerateMobileAuthCode } from "./useGenerateMobileAuthCode";

type MobileLoginRedirectParams = {
    returnUrl: string;
    productId: Hex;
    state?: string;
};

async function openExternalUrl(url: string): Promise<boolean> {
    if (!isTauri()) {
        window.location.href = url;
        return true;
    }

    try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
        return true;
    } catch {
        return false;
    }
}

export function useMobileLoginRedirect() {
    const { generateAuthCode, isGenerating, error } =
        useGenerateMobileAuthCode();
    const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

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

            const finalRedirectUrl = new URL(returnUrl);
            finalRedirectUrl.searchParams.set("frakAuth", authCode);
            finalRedirectUrl.searchParams.set("productId", productId);
            if (state) {
                finalRedirectUrl.searchParams.set("state", state);
            }

            const finalUrl = finalRedirectUrl.toString();
            setRedirectUrl(finalUrl);

            await openExternalUrl(finalUrl);
        },
        [generateAuthCode]
    );

    const retryRedirect = useCallback(async (): Promise<boolean> => {
        if (!redirectUrl) {
            return false;
        }
        return openExternalUrl(redirectUrl);
    }, [redirectUrl]);

    return {
        executeRedirect,
        retryRedirect,
        redirectUrl,
        isRedirecting: isGenerating,
        error,
    };
}
