"use server";

import { getPushTokensRepository } from "@/context/notification/repository/PushTokensRepository";
import { getSession } from "@/context/session/action/session";
import { keccak256, toHex } from "viem";
import type { PushSubscription } from "web-push";

/**
 * Save a new push subscription token for the given user
 */
export async function savePushToken({
    subscription,
}: { subscription: PushSubscriptionJSON }) {
    // Get the current user wallet
    const session = await getSession();
    if (!session?.wallet?.address) {
        return;
    }

    // If the subscription doesn't contain an endpoint, exit
    if (!subscription.endpoint) {
        return;
    }

    // Map the subscription to a valid push subscription
    const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: subscription.keys?.p256dh ?? "no-p256dh-key",
            auth: subscription.keys?.auth ?? "no-auth-key",
        },
    };

    // Rebuild the push token id
    const rawId =
        `${session.wallet}${subscription.endpoint}${pushSubscription.keys.p256dh}`.toLowerCase();
    const id = keccak256(toHex(rawId));

    // Ensure it doesn't exist
    const pushTokenRepository = await getPushTokensRepository();
    const alreadyExist = await pushTokenRepository.existForId(id);
    if (alreadyExist) {
        return;
    }

    // Save the token
    await pushTokenRepository.create({
        _id: id,
        wallet: session.wallet.address,
        pushSubscription,
        expirationTimestamp: subscription.expirationTime ?? undefined,
    });
}
