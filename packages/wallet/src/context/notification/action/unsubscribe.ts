import { getPushTokensRepository } from "@/context/notification/repository/PushTokensRepository";
import { getSession } from "@/context/session/action/session";

/**
 * Unsubscribe a user from all of his push notification
 */
export async function unsubscribeFromPush() {
    const session = await getSession();
    if (!session?.wallet?.address) {
        throw new Error("No wallet found in session");
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
