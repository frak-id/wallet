"use server";

import { getPushTokensRepository } from "@/context/notification/repository/PushTokensRepository";
import type { NotificationPayload } from "@frak-labs/shared/types/NotificationPayload";
import type { Address } from "viem";
import { sendNotification, setVapidDetails } from "web-push";

/**
 * Save a new push subscription token for the given user
 */
export async function sendPush({
    wallets,
    payload,
}: { wallets: Address[]; payload: NotificationPayload }) {
    // Get all the push tokens we will address
    const pushTokenRepository = await getPushTokensRepository();
    const pushTokens = await pushTokenRepository.getForWallets(wallets);

    // Early exit if no push tokens are found
    if (pushTokens.length === 0) {
        console.log("No push tokens found for the given wallets");
        return;
    }

    // Set the vapid details globally\
    setVapidDetails(
        "mailto:hello@frak.id",
        process.env.VAPID_PUBLIC_KEY as string,
        process.env.VAPID_PRIVATE_KEY as string
    );

    // For each push token, send the push\
    const pushPromises = pushTokens.map(async (pushToken) => {
        await sendNotification(
            pushToken.pushSubscription,
            JSON.stringify(payload)
        );
    });

    // Wait for all the push to be sent
    const results = await Promise.allSettled(pushPromises);

    // Log a few infos about the results
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const errorCount = results.filter((r) => r.status === "rejected").length;
    console.log(`Push sent to ${successCount} wallets, ${errorCount} failed`);
}
