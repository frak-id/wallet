import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { modalDisplayedRequestAtom } from "@/module/listener/atoms/modalEvents";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useSetAtom } from "jotai";
import { useCallback } from "react";

type OnAuthenticateRequest = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_siweAuthenticate" }
    >
>;

/**
 * Hook used for the SIWE authentication of a user
 */
export function useSiweAuthenticateListener() {
    const setDisplayedRequest = useSetAtom(modalDisplayedRequestAtom);

    /**
     * The function that will be called when a dashboard action is requested
     * @param request
     * @param emitter
     */
    const onSiweAuthenticateRequest: OnAuthenticateRequest = useCallback(
        async (request, emitter) => {
            // Extract the params
            const siweMessage = request.params[0];
            const context = request.params[1];

            // Build the msg to sign and send emitter to the dialog
            setDisplayedRequest({
                type: "auth",
                args: {
                    siwe: siweMessage,
                    context,
                },
                emitter,
            });
        },
        [setDisplayedRequest]
    );

    return {
        onSiweAuthenticateRequest,
    };
}
