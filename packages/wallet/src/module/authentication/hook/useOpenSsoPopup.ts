import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import { useCallback } from "react";
import type { Hex } from "viem";

/**
 * Hook used to open the SSO popup
 */
export function useOpenSsoPopup() {
    return useCallback(
        ({
            productId,
            metadata,
            directExit,
            redirectUrl,
        }: {
            productId: Hex;
            metadata: AppSpecificSsoMetadata;
            directExit?: boolean;
            redirectUrl?: string;
        }) => {
            if (window === undefined) {
                return;
            }

            // Build the SSO url
            const ssoUrl = new URL(window.location.origin);
            ssoUrl.pathname = "/sso";
            ssoUrl.searchParams.set("productId", productId);
            if (directExit !== undefined) {
                ssoUrl.searchParams.set("directExit", directExit.toString());
            }
            if (redirectUrl !== undefined) {
                ssoUrl.searchParams.set("redirectUrl", redirectUrl);
            }

            // Add metadata
            const { name, logoUrl, homepageLink } = metadata;
            if (logoUrl) ssoUrl.searchParams.set("logoUrl", logoUrl);
            if (homepageLink)
                ssoUrl.searchParams.set("homepageLink", homepageLink);
            if (name) ssoUrl.searchParams.set("name", name);

            // Open the popup
            const windowFeatures =
                "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800";
            const openedWindow = window.open(
                ssoUrl.toString(),
                "nexus",
                windowFeatures
            );
            if (openedWindow) {
                openedWindow.focus();
            }
        },
        []
    );
}
