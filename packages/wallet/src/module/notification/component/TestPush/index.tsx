import { sendPush } from "@/context/notification/action/sendPush";
import { Panel } from "@/module/common/component/Panel";
import { Spinner } from "@module/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { isAddress } from "viem";

/**
 * Simple component to test the push of a notification
 *  fields -> wallet address + title + description
 * @constructor
 */
export function TestPushNotification() {
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const address = data.get("address") as string;
        const title = data.get("title") as string;
        const body = data.get("body") as string;
        send({ address, title, body });
    };

    const { mutate: send, isPending } = useMutation({
        mutationKey: ["push", "send"],
        mutationFn: async ({
            address,
            title,
            body,
        }: { address: string; title: string; body: string }) => {
            if (!isAddress(address)) {
                throw new Error("Invalid address");
            }

            // Send the push notification
            await sendPush({ wallets: [address], payload: { title, body } });
        },
    });

    return (
        <Panel size={"none"} variant={"empty"}>
            <h1>Test Push Notification</h1>
            {isPending && <Spinner />}
            <form onSubmit={handleSubmit}>
                <label>
                    Wallet address:
                    <input type="text" name="address" />
                </label>
                <br />
                <label>
                    Title:
                    <input type="text" name="title" />
                </label>
                <br />
                <label>
                    Body:
                    <input type="text" name="body" />
                </label>
                <button type="submit" disabled={isPending}>
                    Send
                </button>
            </form>
        </Panel>
    );
}
