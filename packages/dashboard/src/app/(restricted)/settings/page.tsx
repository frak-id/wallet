"use client";

import { deleteSession } from "@/context/auth/actions/session";
import { sendPushNotification } from "@/context/crm/actions/sendPush";
import type { SendTransactionReturnType } from "@frak-labs/nexus-sdk/core";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { productInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { Button } from "@module/component/Button";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type Address, encodeFunctionData } from "viem";

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
                        })
                    }
                >
                    Send tx via iframe
                </Button>
            </p>
            {sendTxData && <p>Full response: {JSON.stringify(sendTxData)}</p>}
            <SendTestNotification />
        </>
    );
}

/**
 * Take wallet + title + body
 * @constructor
 */
function SendTestNotification() {
    const { mutate: sendPush, isPending } = useMutation({
        mutationKey: ["push", "send"],
        mutationFn: async ({
            wallet,
            title,
            body,
        }: { wallet: Address; title: string; body: string }) => {
            await sendPushNotification({
                wallets: [wallet],
                payload: {
                    title,
                    body,
                },
            });
        },
    });

    return (
        <>
            <h1>Send test notification</h1>
            <form
                onSubmit={(e) => {
                    e.preventDefault();

                    const data = new FormData(e.currentTarget);
                    const address = data.get("address") as Address;
                    const title = data.get("title") as string;
                    const body = data.get("body") as string;
                    sendPush({wallet: address, title, body});
                }}
            >
                <label>
                    Wallet
                    <input type="text" name={"address"}/>
                </label><br/>
                <label>
                    Title
                    <input type="text" name={"title"}/>
                </label><br/>
                <label>
                    Body
                    <input type="text" name={"body"}/>
                </label><br/>
                <button type={"submit"} disabled={isPending}>
                    Send test notification
                </button>
            </form>
            {isPending && <p>Sending...</p>}
        </>
    );
}
