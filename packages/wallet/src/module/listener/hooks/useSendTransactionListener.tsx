import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { iFrameToggleVisibility } from "@/context/sdk/utils/iFrameToggleVisibility";
import { sendTransactionListenerAtom } from "@/module/listener/atoms/sendTransactionListener";
import { SendTransactionComponent } from "@/module/listener/component/SendTx";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";

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
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    /**
     The current listener param
     */
    const [listenerParam, setListenerParam] = useAtom(
        sendTransactionListenerAtom
    );
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

            console.log("Received a transaction request", {
                tx,
                context,
            });

            // If no action present
            if (!tx) {
                setListenerParam(null);
                setIsDialogOpen(false);
                // And exit
                return;
            }

            // Otherwise, save emitter and params
            setListenerParam({
                tx,
                context,
                emitter,
            });

            // Show the iframe
            iFrameToggleVisibility(true);

            // Tell that the dialog is open
            setIsDialogOpen(true);
        },
        [setListenerParam]
    );

    const closeDialog = useCallback(() => {
        setIsDialogOpen(false);
        iFrameToggleVisibility(false);
    }, []);

    /**
     * Build the send transaction component
     */
    const component = useMemo(() => {
        if (!listenerParam) {
            return null;
        }

        return (
            <SendTransactionComponent
                tx={listenerParam.tx}
                context={listenerParam.context}
                isOpen={isDialogOpen}
                onSuccess={(hash) => {
                    listenerParam.emitter({
                        key: "success",
                        hash,
                    });
                    closeDialog();
                }}
                onPending={() => {
                    listenerParam.emitter({
                        key: "sending",
                    });
                }}
                onError={(reason) => {
                    listenerParam.emitter({
                        key: "error",
                        reason,
                    });
                    closeDialog();
                }}
                onDiscard={() => {
                    listenerParam.emitter({
                        key: "aborted",
                    });
                    closeDialog();
                }}
            />
        );
    }, [listenerParam, isDialogOpen, closeDialog]);

    return {
        onSendTransactionRequest,
        isDialogOpen,
        component,
    };
}
