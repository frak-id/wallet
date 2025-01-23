import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { AccordionTransactions } from "@/module/listener/modal/component/Transaction/AccordionTransactions";
import type { SendTransactionModalStepType } from "@frak-labs/core-sdk";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useMemo } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { useModalTranslation } from "../../../hooks/useModalTranslation";

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
    const { t } = useModalTranslation();
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

            <AuthFingerprint
                className={styles.modalListener__action}
                disabled={isPending}
                action={() => {
                    if (!toSendTx) return;
                    sendTransaction(toSendTx);
                }}
            >
                {t("sdk.modal.sendTransaction.default.primaryAction", {
                    count: txs.length,
                })}
            </AuthFingerprint>

            {isError && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}

function useMappedTx({
    tx,
}: { tx: SendTransactionModalStepType["params"]["tx"] }) {
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
