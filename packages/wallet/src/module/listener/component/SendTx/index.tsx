import { AlertDialog } from "@/module/common/component/AlertDialog";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import type { SendTransactionListenerParam } from "@/module/listener/atoms/sendTransactionListener";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useMemo } from "react";
import { type Hex, formatEther } from "viem";
import { useSendTransaction } from "wagmi";

/**
 * Component that will be displayed when sending a transaction
 * todo: Should reuse some stuff from the wallet connect modal here (in term of presentation, tx infos etc)
 * @param tx
 * @param context
 * @param emitter
 * @constructor
 */
export function SendTransactionComponent({
    tx,
    context,
    isOpen,
    onSuccess,
    onError,
    onDiscard,
}: Pick<SendTransactionListenerParam, "tx" | "context"> & {
    isOpen: boolean;
    onSuccess: (hash: Hex) => void;
    onError: (reason?: string) => void;
    onDiscard: () => void;
}) {
    const { sendTransaction, isPending } = useSendTransaction({
        mutation: {
            // Link success and error hooks
            onSuccess: onSuccess,
            onError: (error) => {
                onError(error.message);
            },
        },
    });

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    onDiscard();
                }
            }}
            title={"Nexus Wallet - Send Transaction"}
            text={
                <>
                    <TxDetails tx={tx} context={context} />
                </>
            }
            action={
                <AuthFingerprint
                    disabled={isPending}
                    action={() => {
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
            }
        />
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
