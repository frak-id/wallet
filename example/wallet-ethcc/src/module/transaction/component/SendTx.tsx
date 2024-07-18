"use client";

import { Panel } from "@/module/common/component/Panel";
import type {
    ModalRpcStepsResultType,
    SendTransactionModalStepType,
} from "@frak-labs/nexus-sdk/core";
import { useDisplayModal } from "@frak-labs/nexus-sdk/react";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { Button } from "@module/component/Button";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
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
                On click, the SDK will ask the Nexus Wallet to perform a
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
                        context: "Test transaction",
                        steps: {
                            sendTransaction: {
                                tx: {
                                    to: addresses.contentInteractionManager,
                                    value: "0x00",
                                    data: encodeFunctionData({
                                        abi: contentInteractionManagerAbi,
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
                href={`https://sepolia.arbiscan.io/tx/${data.sendTransaction.hash}`}
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
        </div>
    );
}
