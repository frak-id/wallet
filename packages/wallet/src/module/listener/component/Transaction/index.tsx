import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import { RequireWebAuthN } from "@/module/common/component/RequireWebAuthN";
import styles from "@/module/listener/component/Modal/index.module.css";
import { AccordionTransactions } from "@/module/listener/component/Transaction/AccordionTransactions";
import type { SendTransactionModalStepType } from "@frak-labs/nexus-sdk/core";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAccount, useSendTransaction } from "wagmi";

/**
 * The component for the transaction step of a modal
 * @param onClose
 * @constructor
 */
export function TransactionModalStep({
    params,
    onFinish,
    onError,
}: {
    params: SendTransactionModalStepType["params"];
    onFinish: (result: SendTransactionModalStepType["returns"]) => void;
    onError: (reason?: string) => void;
}) {
    const { t } = useTranslation();
    const { sendTransaction, isPending, isError, error } = useSendTransaction({
        mutation: {
            // Link success and error hooks
            onSuccess: (hash) => {
                onFinish({ hash });
            },
            onError: (error) => {
                onError(error?.message ?? "Error when sending the transaction");
            },
        },
    });

    const { txs, toSendTx } = useMappedTx({ tx: params.tx });

    if (!(params && toSendTx)) {
        return null;
    }

    return (
        <RequireWebAuthN>
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
        </RequireWebAuthN>
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
