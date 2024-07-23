import {
    type AppSpecificSsoMetadata,
    ssoMetadataAtom,
} from "@/module/authentication/atoms/sso";
import { jotaiStore } from "@module/atoms/store";
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

            // Set the SSO metadata
            jotaiStore.set(ssoMetadataAtom, (prev) => ({
                ...prev,
                [productId]: metadata,
            }));

            // Build the SSO url
            const ssoUrl = new URL(window.location.hostname);
            if (directExit !== undefined) {
                ssoUrl.searchParams.set("directExit", directExit.toString());
            }
            if (redirectUrl !== undefined) {
                ssoUrl.searchParams.set("redirectUrl", redirectUrl);
            }

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
