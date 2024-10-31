import type { NexusClient } from "../types/client";
import type { WalletStatusReturnType } from "../types/rpc/walletStatus";
import { Deferred } from "../utils";

/**
 * Function used to watch the current nexus wallet status
 * @param client
 * @param callback
 */
export function watchWalletStatus(
    client: NexusClient,
    callback?: (status: WalletStatusReturnType) => void
): Promise<WalletStatusReturnType> {
    // If no callback is provided, just do a request with deferred result
    if (!callback) {
        return client.request({ method: "frak_listenToWalletStatus" });
    }

    // Otherwise, listen to the wallet status and return the first one received
    const firstResult = new Deferred<WalletStatusReturnType>();
    let hasResolved = false;

    // Start the listening request, and return the first result
    return client
        .listenerRequest(
            {
                method: "frak_listenToWalletStatus",
            },
            (status) => {
                // Transmit the status to the callback
                callback(status);

                // If the promise hasn't resolved yet, resolve it
                if (!hasResolved) {
                    firstResult.resolve(status);
                    hasResolved = true;
                }
            }
        )
        .then(() => firstResult.promise);
}
