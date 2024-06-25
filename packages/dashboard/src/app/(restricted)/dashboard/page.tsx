"use client";

import { contentInteractionManagerAbi } from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import { Button } from "@/module/common/component/Button";
import { useWallet } from "@/module/common/hook/useWallet";
import type { SendTransactionReturnType } from "@frak-labs/nexus-sdk/core";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useSiweAuthenticate } from "@frak-labs/nexus-sdk/react";
import { useEffect, useState } from "react";
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

    const {
        mutate: authenticate,
        error,
        status,
        data: authResult,
    } = useSiweAuthenticate();

    useEffect(() => {
        console.log("Siwe auth result", { status, error, authResult });
    }, [error, status, authResult]);

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
                <h1>Authentication</h1>
                <p>
                    <Button
                        onClick={() =>
                            authenticate({
                                context: "Test authentication",
                                siwe: {},
                            })
                        }
                    >
                        Authenticate via iframe
                    </Button>
                </p>
                {authResult?.key && <p>sendTx key: {authResult.key}</p>}
                {authResult && (
                    <p>Full response: {JSON.stringify(authResult)}</p>
                )}
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
