import {
    ssoPopupFeatures,
    ssoPopupName,
    useGetOpenSsoLink,
} from "@/module/authentication/hook/useGetOpenSsoLink";
import type { WalletRpcContext } from "@/module/listener/types/context";
import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import { RpcErrorCodes } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/rpc";
import { useCallback } from "react";

type OnOpenSso = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_sso",
    WalletRpcContext
>;

/**
 * Hook use to listen to the wallet status
 *
 * Note: Context is augmented by middleware with productId, sourceUrl, etc.
 */
export function useOnOpenSso(): OnOpenSso {
    const getOpenSsoLink = useGetOpenSsoLink();

    return useCallback(
        async (params, context) => {
            // Extract request infos
            const ssoInfo = params[0];
            const name = params[1];
            const css = params[2];

            // If we are on the server side directly exit with an error
            if (typeof window === "undefined") {
                throw {
                    code: RpcErrorCodes.internalError,
                    message: "Server side not supported",
                };
            }

            // Determine if we should open in same window
            // Default to true if redirectUrl is provided, unless explicitly overridden
            const openInSameWindow =
                ssoInfo.openInSameWindow ?? ssoInfo.redirectUrl;

            const { url: ssoLink, trackingId } = await getOpenSsoLink({
                productId: context.productId,
                metadata: {
                    ...ssoInfo.metadata,
                    name,
                    css,
                },
                directExit: ssoInfo.directExit,
                redirectUrl: ssoInfo.redirectUrl,
                consumeKey: ssoInfo.consumeKey,
                lang: ssoInfo.lang,
            });

            try {
                if (openInSameWindow) {
                    // Open in same window
                    window.location.href = ssoLink;
                    // Return result with trackingId
                    return { trackingId };
                }

                // Open the popup
                const openedWindow = window.open(
                    ssoLink,
                    ssoPopupName,
                    ssoPopupFeatures
                );
                if (openedWindow) {
                    openedWindow.focus();
                    // Return result with trackingId
                    return { trackingId };
                }
            } catch (error) {
                console.warn("Unable to open the SSO page", error);
            }

            // If we reach here, opening failed
            throw {
                code: RpcErrorCodes.internalError,
                message: "Failed to open the SSO",
            };
        },
        [getOpenSsoLink]
    );
}
