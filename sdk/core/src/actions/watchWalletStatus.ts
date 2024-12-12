import type { FrakClient } from "../types/client";
import type { WalletStatusReturnType } from "../types/rpc/walletStatus";
import { Deferred } from "../utils";

/**
 * Function used to watch the current nexus wallet status
 * @param client
 * @param callback
 */
export function watchWalletStatus(
    client: FrakClient,
    callback?: (status: WalletStatusReturnType) => void
): Promise<WalletStatusReturnType> {
    // If no callback is provided, just do a request with deferred result
    if (!callback) {
        return client
            .request({ method: "frak_listenToWalletStatus" })
            .then((result) => {
                // Save the potential interaction token
                savePotentialToken(result.interactionToken);

                // Return the result
                return result;
            });
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

                // Save the potential interaction token
                savePotentialToken(status.interactionToken);

                // If the promise hasn't resolved yet, resolve it
                if (!hasResolved) {
                    firstResult.resolve(status);
                    hasResolved = true;
                }
            }
        )
        .then(() => firstResult.promise);
}

/**
 * Helper to save a potential interaction token
 * @param interactionToken
 */
function savePotentialToken(interactionToken?: string) {
    if (typeof window === "undefined") {
        return;
    }

    if (interactionToken) {
        // If we got an interaction token, save it
        window.sessionStorage.setItem(
            "frak-wallet-interaction-token",
            interactionToken
        );
    } else {
        // Otherwise, remove it
        window.sessionStorage.removeItem("frak.interaction-token");
    }
}
