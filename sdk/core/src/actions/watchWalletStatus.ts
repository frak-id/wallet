import { Deferred } from "@frak-labs/rpc";
import type { FrakClient } from "../types/client";
import type { WalletStatusReturnType } from "../types/rpc/walletStatus";

/**
 * Function used to watch the current frak wallet status
 * @param client - The current Frak Client
 * @param callback - The callback that will receive any wallet status change
 * @returns A promise resolving with the initial wallet status
 *
 * @description This function will return the current wallet status, and will listen to any change in the wallet status.
 *
 * @example
 * await watchWalletStatus(frakConfig, (status: WalletStatusReturnType) => {
 *     if (status.key === "connected") {
 *         console.log("Wallet connected:", status.wallet);
 *         console.log("Current interaction session:", status.interactionSession);
 *     } else {
 *         console.log("Wallet not connected");
 *     }
 * });
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
                // Handle side effects of this request
                walletStatusSideEffect(client, result);

                // Return the result
                return result;
            });
    }

    // Otherwise, listen to the wallet status and return the first one received
    const firstResult = new Deferred<WalletStatusReturnType>();
    let hasResolved = false;

    // Start the listening request, and return the first result
    client.listenerRequest(
        {
            method: "frak_listenToWalletStatus",
        },
        (status) => {
            // Handle side effects of this request
            walletStatusSideEffect(client, status);

            // Transmit the status to the callback
            callback(status);

            // If the promise hasn't resolved yet, resolve it
            if (!hasResolved) {
                firstResult.resolve(status);
                hasResolved = true;
            }
        }
    );

    return firstResult.promise;
}

/**
 * Helper to save a potential interaction token
 * @param interactionToken
 */
function walletStatusSideEffect(
    client: FrakClient,
    status: WalletStatusReturnType
) {
    if (typeof window === "undefined") {
        return;
    }

    // Update the global properties
    client.openPanel?.setGlobalProperties({
        wallet: status.wallet ?? null,
    });

    if (status.interactionToken) {
        // If we got an interaction token, save it
        window.sessionStorage.setItem(
            "frak-wallet-interaction-token",
            status.interactionToken
        );
    } else {
        // Otherwise, remove it
        window.sessionStorage.removeItem("frak-wallet-interaction-token");
    }
}
