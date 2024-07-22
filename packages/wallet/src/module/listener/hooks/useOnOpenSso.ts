import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { ssoMetadataAtom } from "@/module/authentication/atoms/sso";
import { useOpenSsoPopup } from "@/module/authentication/hook/useOpenSsoPopup";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    RpcErrorCodes,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { useCallback } from "react";

type OnOpenSso = IFrameRequestResolver<
    Extract<ExtractedParametersFromRpc<IFrameRpcSchema>, { method: "frak_sso" }>
>;

/**
 * Hook use to listen to the wallet status
 */
export function useOnOpenSso(): OnOpenSso {
    const openSsoPopup = useOpenSsoPopup();

    return useCallback(
        async (request, emitter) => {
            // Extract request infos
            const ssoInfo = request.params[0];
            const name = request.params[1];
            const css = request.params[2];

            // If we are on the server side directly exit with an error
            if (window === undefined) {
                emitter({
                    error: {
                        code: RpcErrorCodes.internalError,
                        message: "Server side not supported",
                    },
                });
                return;
            }

            openSsoPopup({
                metadata: {
                    ...ssoInfo.metadata,
                    name,
                    css,
                },
                directExit: ssoInfo.directExit,
                redirectUrl: ssoInfo.redirectUrl,
            });

            // Set the SSO metadata
            jotaiStore.set(ssoMetadataAtom, {
                ...ssoInfo.metadata,
                name,
                css,
            });

            // Emit the end
            emitter({
                result: undefined,
            });
        },
        [openSsoPopup]
    );
}
