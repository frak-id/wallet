import type { FrakClient } from "../types/client.ts";
import type { WalletStatusReturnType } from "../types/rpc/walletStatus.ts";

/**
 * Function used to watch the current nexus wallet status
 * @param client
 * @param callback
 */
export function watchWalletStatus(
    client: FrakClient,
    callback: (status: WalletStatusReturnType) => void
) {
    return client.listenerRequest(
        {
            method: "frak_listenToWalletStatus",
        },
        callback
    );
}
