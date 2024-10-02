import type { NexusClient, WalletStatusReturnType } from "../../types";
import { Deferred } from "../../utils/Deferred";
import { watchWalletStatus } from "../watchWalletStatus";

export async function walletStatus(
    client: NexusClient,
    callback?: (status: WalletStatusReturnType) => void
) {
    // Our first result deferred
    const firstResult = new Deferred<WalletStatusReturnType>();
    let hasResolved = false;

    // Setup the listener, with a callback request that will resolve the first result
    await watchWalletStatus(client, (status) => {
        callback?.(status);

        // If the promise hasn't resolved yet, resolve it
        if (!hasResolved) {
            firstResult.resolve(status);
            hasResolved = true;
        }
    });

    // Wait for the first response
    return firstResult.promise;
}
