"use client";

import { deleteSession } from "@/context/auth/actions/session";
import type { SendTransactionReturnType } from "@frak-labs/nexus-sdk/core";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { Button } from "@module/component/Button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { encodeFunctionData } from "viem";

export default function SettingsPage() {
    const [sendTxData] = useState<SendTransactionReturnType | null>(null);
    const { mutate: sendTx } = useSendTransactionAction();
    const router = useRouter();

    return (
        <>
            <h1>Settings</h1>
            <Button
                onClick={() => {
                    deleteSession().then(() => {
                        router.push("/login");
                    });
                }}
            >
                Logout
            </Button>
            <h1>Send tx interaction</h1>
            <p>
                <Button
                    onClick={() =>
                        sendTx({
                            metadata: {
                                context: "Test transaction",
                            },
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
            {sendTxData && <p>Full response: {JSON.stringify(sendTxData)}</p>}
        </>
    );
}
