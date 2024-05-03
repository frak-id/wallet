import type { Address, Hex } from "viem";
import type { NexusClient, SetUserReferredReturnType } from "../types";

/**
 * Type used to get the user referred options
 */
export type SetUserReferredParams = {
    contentId: Hex;
    walletAddress: Address;
};

/**
 * Function used to watch a current user referred
 * @param client
 * @param contentId
 * @param walletAddress
 * @param callback
 */
export function setUserReferred(
    client: NexusClient,
    { contentId, walletAddress }: SetUserReferredParams,
    callback: (status: SetUserReferredReturnType) => void
) {
    return client.listenerRequest(
        {
            method: "frak_listenToSetUserReferred",
            params: [contentId, walletAddress],
        },
        callback
    );
}
