"use client";
import { contentInteractionManagerAbi } from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import { Button } from "@/module/common/component/Button";
import { useWallet } from "@/module/common/hook/useWallet";
import type { SendTransactionReturnType } from "@frak-labs/nexus-sdk/core";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useState } from "react";
import { encodeFunctionData } from "viem";

export default function RestrictedPage() {
    const { data, launch: doOpen } = useWallet({
        action: "open",
        params: "something",
    });

    const [sendTxData, setSendTxData] =
        useState<SendTransactionReturnType | null>(null);
    const { mutate: sendTx } = useSendTransactionAction({
        callback: setSendTxData,
    });

    return (
        <>
            <div>
                <h1>Dashboard interaction</h1>
                <p>
                    <Button onClick={() => doOpen()}>
                        open iframe interaction
                    </Button>
                </p>
                {data?.key && <p>response key: {data.key}</p>}
                {data?.value && <p>response value: {data.value}</p>}
            </div>

            <div>
                <h1>Send tx interaction</h1>
                <p>
                    <Button
                        onClick={() =>
                            sendTx({
                                context: "Test transaction",
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
                            })
                        }
                    >
                        Send tx via iframe
                    </Button>
                </p>
                {sendTxData?.key && <p>sendTx key: {sendTxData.key}</p>}
                {sendTxData && (
                    <p>Full response: {JSON.stringify(sendTxData)}</p>
                )}
            </div>
        </>
    );
}
