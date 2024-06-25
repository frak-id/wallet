import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { iFrameToggleVisibility } from "@/context/sdk/utils/iFrameToggleVisibility";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import {
    type SendTransactionListenerParam,
    sendTransactionListenerAtom,
} from "@/module/listener/atoms/sendTransactionListener";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { useSendTransaction } from "wagmi";

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
     * The current dashboard action listener param
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

/**
 * Component that will be displayed when sending a transaction
 * todo: Should reuse some stuff from the wallet connect modal here (in term of presentation, tx infos etc)
 * @param tx
 * @param context
 * @param emitter
 * @constructor
 */
function SendTransactionComponent({
    tx,
    context,
    isOpen,
    onSuccess,
    onError,
    onPending,
    onDiscard,
}: Pick<SendTransactionListenerParam, "tx" | "context"> & {
    isOpen: boolean;
    onSuccess: (hash: Hex) => void;
    onPending: () => void;
    onError: (reason?: string) => void;
    onDiscard: () => void;
}) {
    const { sendTransaction, status, isPending } = useSendTransaction({
        mutation: {
            // Link success and error hooks
            onSuccess: onSuccess,
            onError: (error) => {
                onError(error.message);
            },
        },
    });

    // Emit the pending state
    useEffect(() => {
        if (status === "pending") {
            onPending();
        }
    }, [onPending, status]);

    return (
        <AlertDialog
            open={isOpen}
            text={
                <>
                    <h2>Send a transaction</h2>

                    <TxDetails tx={tx} context={context} />

                    <ButtonRipple
                        disabled={isPending}
                        onClick={() => {
                            // TODO: Should bundle the tx if it's an array
                            const toExecute = Array.isArray(tx) ? tx : [tx];
                            sendTransaction({
                                to: toExecute[0].to,
                                data: toExecute[0].data,
                                value: BigInt(toExecute[0].value),
                            });
                        }}
                    >
                        Send transaction
                    </ButtonRipple>
                    <ButtonRipple
                        disabled={isPending}
                        onClick={() => onDiscard()}
                    >
                        Discard transaction
                    </ButtonRipple>
                </>
            }
        />
    );
}

function TxDetails({
    tx,
    context,
}: Pick<SendTransactionListenerParam, "tx" | "context">) {
    // Tx in the array format
    const txs = useMemo(() => {
        if (Array.isArray(tx)) {
            return tx;
        }
        return [tx];
    }, [tx]);

    return (
        <div>
            {context ? <p>{context}</p> : null}
            <h3>Transaction</h3>
            {txs.map((tx, index) => (
                <div key={`${index}-${tx.to}`}>
                    <p>{tx.to}</p>
                    <p>{tx.value}</p>
                    <p>{tx.data}</p>
                </div>
            ))}
        </div>
    );
}
