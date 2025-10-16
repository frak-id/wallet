import type { SendTransactionModalStepType } from "@frak-labs/core-sdk";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { encodeWalletMulticall } from "@frak-labs/wallet-shared/wallet/utils/multicall";
import { useMemo } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { HandleErrors } from "@/module/component/HandleErrors";
import { AccordionTransactions } from "@/module/modal/component/Transaction/AccordionTransactions";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";

/**
 * The component for the transaction step of a modal
 * @param onClose
 * @constructor
 */
export function TransactionModalStep({
    params,
    onFinish,
}: {
    params: SendTransactionModalStepType["params"];
    onFinish: (result: SendTransactionModalStepType["returns"]) => void;
}) {
    const { t } = useListenerTranslation();
    const { sendTransaction, isPending, isError, error } = useSendTransaction({
        mutation: {
            // Link success and error hooks
            onSuccess: (hash) => {
                onFinish({ hash });
            },
        },
    });

    const { txs, toSendTx } = useMappedTx({ tx: params.tx });

    if (!(params && toSendTx)) {
        return null;
    }

    return (
        <>
            <AccordionTransactions txs={txs} />

            <ButtonAuth
                size={"small"}
                width={"full"}
                disabled={isPending}
                onClick={() => {
                    if (!toSendTx) return;
                    sendTransaction(toSendTx);
                }}
            >
                {t("sdk.modal.sendTransaction.primaryAction", {
                    count: txs.length,
                })}
            </ButtonAuth>

            {isError && error && <HandleErrors error={error} />}
        </>
    );
}

function useMappedTx({
    tx,
}: {
    tx: SendTransactionModalStepType["params"]["tx"];
}) {
    const { address } = useAccount();

    return useMemo(() => {
        if (!(tx || !address)) {
            return {
                txs: [],
                toSendTx: undefined,
            };
        }

        // Case of a single tx
        if (!Array.isArray(tx)) {
            return {
                txs: [tx],
                toSendTx: { ...tx, value: tx.value ? BigInt(tx.value) : 0n },
            };
        }

        // Otherwise, prepare a batch call
        return {
            txs: tx,
            toSendTx: {
                to: address,
                value: 0n,
                data: encodeWalletMulticall(
                    tx.map((tx) => ({
                        to: tx.to,
                        data: tx.data ?? "0x",
                        value: tx.value ? BigInt(tx.value) : undefined,
                    }))
                ),
            },
        };
    }, [address, tx]);
}
