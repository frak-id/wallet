import { Panel } from "@/module/common/component/Panel";
import {
    addresses,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import type {
    ModalRpcStepsResultType,
    SendTransactionModalStepType,
} from "@frak-labs/core-sdk";
import { useDisplayModal } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { BadgeCheck } from "lucide-react";
import { Link } from "react-router";
import { encodeFunctionData } from "viem";

export function SendTransaction() {
    const {
        mutate: displayModal,
        data,
        error,
        status,
        isPending,
    } = useDisplayModal();

    return (
        <Panel variant={"primary"}>
            <h2>Send transaction</h2>

            <p>
                On click, the SDK will ask the Frak Wallet to perform a
                transaction on arbitrum sepolia.
            </p>
            <p>
                The SDK will return either an error, or the successful
                transaction hash.
            </p>
            <br />

            <p>Send transaction state: {status}</p>
            <br />

            <Button
                onClick={() =>
                    displayModal({
                        steps: {
                            sendTransaction: {
                                tx: {
                                    to: addresses.productInteractionManager,
                                    value: "0x00",
                                    data: encodeFunctionData({
                                        abi: productInteractionManagerAbi,
                                        functionName: "getInteractionContract",
                                        args: [
                                            106219508196454080375526586478153583586194937194493887259467424694676997453395n,
                                        ],
                                    }),
                                },
                            },
                        },
                    })
                }
                type={"button"}
                disabled={isPending}
            >
                Send transaction
            </Button>
            <br />

            {data && <SendTxResult data={data} />}

            {error && <SendTxError error={error} />}
        </Panel>
    );
}

// Display the authentication result well formatted
function SendTxResult({
    data,
}: { data: ModalRpcStepsResultType<[SendTransactionModalStepType]> }) {
    return (
        <div>
            <h4>
                <BadgeCheck />
                Send TX success
            </h4>

            <p>TxHash: {data.sendTransaction.hash}</p>
            <Link
                to={`https://sepolia.arbiscan.io/tx/${data.sendTransaction.hash}`}
                target={"_blank"}
            >
                View on arbiscan
            </Link>
        </div>
    );
}

function SendTxError({ error }: { error: Error }) {
    return (
        <div>
            <h4>Send transaction error</h4>

            <p>{error.message}</p>
            <p>{JSON.stringify(error)}</p>
        </div>
    );
}
