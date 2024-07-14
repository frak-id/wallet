import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { modalDisplayedRequestAtom } from "@/module/listener/atoms/modalEvents";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
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
export function useSiweAuthenticateListener(): OnAuthenticateRequest {
    /**
     * The function that will be called when a dashboard action is requested
     * @param request
     * @param emitter
     */
    return useCallback(async (request, emitter) => {
        // Extract the params
        const siweMessage = request.params[0];
        const context = request.params[1];

        // Set the request in the jotai store
        jotaiStore.set(modalDisplayedRequestAtom, {
            type: "auth",
            args: {
                siwe: siweMessage,
                context,
            },
            emitter,
        });
    }, []);
}
