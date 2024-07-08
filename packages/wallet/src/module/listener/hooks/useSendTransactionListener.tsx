import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { modalDisplayedRequestAtom } from "@/module/listener/atoms/modalEvents";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useSetAtom } from "jotai";
import { useCallback } from "react";

type OnSendTransactionRequest = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_sendTransaction" }
    >
>;

/**
 * Hook used to listen to the send transaction action
 * todo: If parent window isn't from "frak.id", should throw an error
 * todo: Should also handle this event type in a redirection context (like the article unlock stuff)
 * todo: Should have a top level "receiveAction" page, receiving stuff (like paywall unlock / send tx / login etc), performing the action and redirection
 * todo: The component use inside the "receiveAction" should be the same as the one used inside each AlertDialog here
 */
export function useSendTransactionListener() {
    const setDisplayedRequest = useSetAtom(modalDisplayedRequestAtom);

    /**
     * The function that will be called when a dashboard action is requested
     * @param request
     * @param emitter
     */
    const onSendTransactionRequest: OnSendTransactionRequest = useCallback(
        async (request, emitter) => {
            // Extract the action and params
            const tx = request.params[0];
            const context = request.params[1];

            // If no action present
            if (!tx) {
                // Exit
                return;
            }

            // Otherwise, send emitter to the dialog
            setDisplayedRequest({
                type: "transaction",
                args: {
                    tx,
                    context,
                },
                emitter,
            });
        },
        [setDisplayedRequest]
    );

    return {
        onSendTransactionRequest,
    };
}
