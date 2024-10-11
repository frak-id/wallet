import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import { ssoParamsToCompressed } from "@/module/authentication/utils/ssoDataCompression";
import { compressJson } from "@frak-labs/nexus-sdk/core";
import { useCallback } from "react";
import type { Hex } from "viem";

/**
 * Hook used to open the SSO popup
 */
export function useOpenSsoPopup() {
    return useCallback(
        async ({
            productId,
            metadata,
            directExit,
            redirectUrl,
            lang,
        }: {
            productId: Hex;
            metadata: AppSpecificSsoMetadata;
            directExit?: boolean;
            redirectUrl?: string;
            lang?: "en" | "fr";
        }) => {
            if (window === undefined) {
                return;
            }

            // Build the sso compressed param
            const compressedParam = ssoParamsToCompressed({
                productId,
                metadata,
                directExit,
                redirectUrl,
                lang,
            });
            const compressedString = await compressJson(compressedParam);

            // Build the url with the params
            const ssoUrl = new URL(window.location.origin);
            ssoUrl.pathname = "/sso";
            ssoUrl.searchParams.set("p", compressedString);

            // Open the popup
            const windowFeatures =
                "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800";
            const openedWindow = window.open(
                ssoUrl.toString(),
                "frak-sso",
                windowFeatures
            );
            if (openedWindow) {
                openedWindow.focus();
            }
        },
        []
    );
}
