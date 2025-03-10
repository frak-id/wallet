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

            const { url: ssoLink } = await getOpenSsoLink({
                productId: context.productId,
                metadata: {
                    ...ssoInfo.metadata,
                    name,
                    css,
                },
                directExit: ssoInfo.directExit,
                redirectUrl: ssoInfo.redirectUrl,
                lang: ssoInfo.lang,
            });

            try {
                // Open the popup
                const openedWindow = window.open(
                    ssoLink,
                    ssoPopupName,
                    ssoPopupFeatures
                );
                if (openedWindow) {
                    openedWindow.focus();
                    // Emit the end
                    await emitter({
                        result: undefined,
                    });
                    return;
                }
            } finally {
                // Otherwise, emit an error
                await emitter({
                    error: {
                        code: RpcErrorCodes.internalError,
                        message: "Failed to open the SSO",
                    },
                });
            }
        },
        [getOpenSsoLink]
    );
}
