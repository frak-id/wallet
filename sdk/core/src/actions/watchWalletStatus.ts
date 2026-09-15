import { Deferred } from "@frak-labs/frame-connector";
import type { FrakClient } from "../types/client";
import type { WalletStatusReturnType } from "../types/rpc/walletStatus";
import { ensureIdentity } from "./ensureIdentity";

/**
 * Watch the current Frak wallet status
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
 *     } else {
 *         console.log("Wallet not connected");
 *     }
 * });
 */
export function watchWalletStatus(
    client: FrakClient,
    callback?: (status: WalletStatusReturnType) => void
): Promise<WalletStatusReturnType> {
    if (!callback) {
        return client
            .request({ method: "frak_listenToWalletStatus" })
            .then((result) => {
                walletStatusSideEffect(client, result);
                return result;
            });
    }

    const firstResult = new Deferred<WalletStatusReturnType>();
    let hasResolved = false;

    client.listenerRequest(
        {
            method: "frak_listenToWalletStatus",
        },
        (status) => {
            walletStatusSideEffect(client, status);
            callback(status);

            if (!hasResolved) {
                firstResult.resolve(status);
                hasResolved = true;
            }
        }
    );

    return firstResult.promise;
}

/** Persist the interaction token and refresh the analytics globals. */
function walletStatusSideEffect(
    client: FrakClient,
    status: WalletStatusReturnType
) {
    if (typeof window === "undefined") {
        return;
    }

    client.openPanel?.setGlobalProperties({
        wallet: status.wallet ?? null,
    });

    if (status.interactionToken) {
        window.sessionStorage.setItem(
            "frak-wallet-interaction-token",
            status.interactionToken
        );
        ensureIdentity(status.interactionToken);
    } else {
        window.sessionStorage.removeItem("frak-wallet-interaction-token");
    }
}
