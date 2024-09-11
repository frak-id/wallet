"use server";

import { getPushTokensRepository } from "@/context/notification/repository/PushTokensRepository";
import { getSession } from "@/context/session/action/session";

/**
 * Unsubscribe a user from all of his push notification
 */
export async function unsubscribeFromPush() {
    const session = await getSession();
    if (!session?.wallet?.address) {
        return;
    }

    // Get the push token repository
    const pushTokenRepository = await getPushTokensRepository();
    const result = await pushTokenRepository.removeAllForWallet(
        session.wallet.address
    );
    console.log(
        `Unsubscribed ${result.deletedCount} push tokens for wallet ${session.wallet.address}`
    );
}

/**
 * Check if the current user has some push tokens
 */
export async function hasPushTokens() {
    const session = await getSession();
    if (!session?.wallet?.address) {
        return;
    }

    // Get the push token repository
    const pushTokenRepository = await getPushTokensRepository();
    const pushTokens = await pushTokenRepository.getForWallets([
        session.wallet.address,
    ]);
    return pushTokens.length > 0;
}
