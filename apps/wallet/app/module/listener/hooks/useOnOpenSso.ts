import {
    ssoPopupFeatures,
    ssoPopupName,
    useGetOpenSsoLink,
} from "@/module/authentication/hook/useGetOpenSsoLink";
import type { IFrameRequestResolver } from "@/module/sdk/utils/iFrameRequestResolver";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    RpcErrorCodes,
} from "@frak-labs/core-sdk";
import { useCallback } from "react";

type OnOpenSso = IFrameRequestResolver<
    Extract<ExtractedParametersFromRpc<IFrameRpcSchema>, { method: "frak_sso" }>
>;

/**
 * Hook use to listen to the wallet status
 */
export function useOnOpenSso(): OnOpenSso {
    const getOpenSsoLink = useGetOpenSsoLink();

    return useCallback(
        async (request, context, emitter) => {
            // Extract request infos
            const ssoInfo = request.params[0];
            const name = request.params[1];
            const css = request.params[2];

            // If we are on the server side directly exit with an error
            if (window === undefined) {
                await emitter({
                    error: {
                        code: RpcErrorCodes.internalError,
                        message: "Server side not supported",
                    },
                });
                return;
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
                    // Emit result with consumeKey if generated
                    await emitter({
                        result: { trackingId },
                    });
                    return;
                }

                // Open the popup
                const openedWindow = window.open(
                    ssoLink,
                    ssoPopupName,
                    ssoPopupFeatures
                );
                if (openedWindow) {
                    openedWindow.focus();
                    // Emit result with consumeKey if generated
                    await emitter({
                        result: { trackingId },
                    });
                    return;
                }
            } catch (error) {
                console.warn("Unable to open the SSO page", error);
            }

            // If we reach here, opening failed
            await emitter({
                error: {
                    code: RpcErrorCodes.internalError,
                    message: "Failed to open the SSO",
                },
            });
        },
        [getOpenSsoLink]
    );
}
