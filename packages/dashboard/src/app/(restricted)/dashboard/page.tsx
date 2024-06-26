"use client";
import { deleteSession } from "@/context/auth/actions/session";
import { contentInteractionManagerAbi } from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import { Button } from "@/module/common/component/Button";
import type { SendTransactionReturnType } from "@frak-labs/nexus-sdk/core";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { encodeFunctionData } from "viem";

export default function DashboardPage() {
    const [sendTxData, setSendTxData] =
        useState<SendTransactionReturnType | null>(null);
    const { mutate: sendTx } = useSendTransactionAction({
        callback: setSendTxData,
    });

    const router = useRouter();

    return (
        <>
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

            <div>
                <Button
                    onClick={() => {
                        deleteSession().then(() => {
                            router.push("/login");
                        });
                    }}
                >
                    Logout
                </Button>
            </div>
        </>
    );
}
