"use server";

import type { NotificationPayload } from "@frak-labs/shared/types/NotificationPayload";
import ky from "ky";
import type { Address } from "viem";

/**
 * Method used to send push notifications to a target audience
 */
export async function sendPushNotification({
    wallets,
    payload,
}: { wallets: Address[]; payload: NotificationPayload }) {
    // Send the push request
    await ky.post(`${process.env.NEXUS_WALLET_URL}/api/web-push/send`, {
        json: {
            wallets,
            payload,
        },
    });
}
