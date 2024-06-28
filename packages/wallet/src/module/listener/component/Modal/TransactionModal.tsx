import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { TextData } from "@/module/common/component/TextData";
import { Title } from "@/module/common/component/Title";
import { ListenerModalHeader } from "@/module/listener/component/Modal";
import { AccordionTransactions } from "@/module/listener/component/Transaction/AccordionTransactions";
import type { modalEventRequestArgs } from "@/module/listener/types/modalEvent";
import { useEffect } from "react";
import type { Hex } from "viem";
import { useSendTransaction } from "wagmi";
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

    const onPending = () => {
        listener?.emitter({
            key: "sending",
        });
    };

    const { sendTransaction, status, isPending, isError, error } =
        useSendTransaction({
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

    const tx = listener?.tx;
    const txs = Array.isArray(tx) ? tx : [tx];

    if (!listener) {
        return null;
    }

    return (
        <>
            <ListenerModalHeader title={"Transaction"} />
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
                    if (!txs.length) return;
                    // TODO: Should bundle the tx if it's an array
                    sendTransaction({
                        to: txs[0].to,
                        data: txs[0].data,
                        value: BigInt(txs[0].value),
                    });
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
