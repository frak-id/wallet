import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { TextData } from "@/module/common/component/TextData";
import { Title } from "@/module/common/component/Title";
import { AccordionTransactions } from "@/module/listener/component/Transaction/AccordionTransactions";
import type { modalEventRequestArgs } from "@/module/listener/types/modalEvent";
import { useMemo } from "react";
import type { Hex } from "viem";
import { useAccount, useSendTransaction } from "wagmi";
import styles from "./index.module.css";

export function TransactionModal({
    args: { listener },
    onHandle,
}: {
    args: Extract<modalEventRequestArgs, { type: "transaction" }>;
    onHandle: () => void;
}) {
    const onSuccess = (hash: Hex) => {
        listener?.emitter({
            key: "success",
            hash,
        });
        onHandle();
    };

    const onError = (reason?: string) => {
        listener?.emitter({
            key: "error",
            reason,
        });
    };

    const { address } = useAccount();

    const { sendTransaction, isPending, isError, error } = useSendTransaction({
        mutation: {
            // Link success and error hooks
            onSuccess: onSuccess,
            onError: (error) => {
                onError(error.message);
            },
        },
    });

    const tx = listener?.tx;
    const { txs, sendTx: toSendTx } = useMemo(() => {
        // Case of a single tx
        if (!Array.isArray(tx))
            return { txs: [tx], sendTx: { ...tx, value: BigInt(tx.value) } };

        if (!address) throw new Error("No address present");

        // Othersiwse, prepare a batch call
        return {
            txs: tx,
            sendTx: {
                to: address,
                value: 0n,
                data: encodeWalletMulticall(
                    tx.map((tx) => ({
                        to: tx.to,
                        data: tx.data,
                        value: BigInt(tx.value),
                    }))
                ),
            },
        };
    }, [tx, address]);

    if (!listener) {
        return null;
    }

    return (
        <>
            <Title className={styles.modalListener__subTitle}>
                You need to confirm this transaction
            </Title>
            <TextData>
                {listener.context ? (
                    <p className={styles.modalListener__context}>
                        {listener.context}
                    </p>
                ) : null}
                <AccordionTransactions txs={txs} />
            </TextData>

            <AuthFingerprint
                className={styles.modalListener__action}
                disabled={isPending}
                action={() => {
                    if (!toSendTx) return;
                    sendTransaction(toSendTx);
                }}
            >
                Send transaction{txs.length > 1 ? "s" : ""}
            </AuthFingerprint>

            {isError && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}
