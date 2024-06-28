import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { TextData } from "@/module/common/component/TextData";
import { Title } from "@/module/common/component/Title";
import { ListenerModalHeader } from "@/module/listener/component/Modal";
import type { modalEventRequestArgs } from "@/module/listener/types/modalEvent";
import type { SendTransactionListenerParam } from "@/module/listener/types/transaction";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useEffect, useMemo } from "react";
import { type Hex, formatEther } from "viem";
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
                <TxDetails tx={listener.tx} context={listener.context} />
            </TextData>

            <AuthFingerprint
                className={styles.modalListener__action}
                disabled={isPending}
                action={() => {
                    if (!tx) return;
                    // TODO: Should bundle the tx if it's an array
                    const toExecute = Array.isArray(tx) ? tx : [tx];
                    sendTransaction({
                        to: toExecute[0].to,
                        data: toExecute[0].data,
                        value: BigInt(toExecute[0].value),
                    });
                }}
            >
                Send transaction{Array.isArray(tx) ? "s" : ""}
            </AuthFingerprint>

            {isError && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}

/**
 * todo: Better UI
 *  - Show in collapsing code block if multiple txs
 *  - Need to show to and then data if not 0 and value if not 0
 * @param tx
 * @param context
 * @constructor
 */
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
            {txs.map((tx, index) => (
                <div key={`${index}-${tx.to}`}>
                    <p>
                        To: <WalletAddress wallet={tx.to} />
                    </p>

                    {BigInt(tx.value) > 0n ? (
                        <p>Amount: ${formatEther(BigInt(tx.value))}</p>
                    ) : null}

                    {BigInt(tx.data.length) > 0n ? (
                        <p>Data: {tx.data}</p>
                    ) : null}
                </div>
            ))}
        </div>
    );
}
