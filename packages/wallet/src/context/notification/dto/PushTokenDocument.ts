import type { Address, Hex } from "viem";
import type { PushSubscription } from "web-push";

/**
 * Represent a push token in our mongo db
 */
export type PushTokenDocument = Readonly<{
    // The id of the push token (keccak hash of wallet + push subscription endpoint)
    _id: Hex;
    // The associated wallet address
    wallet: Address;
    // The push endpoint
    pushSubscription: PushSubscription;
    // The expiration time of this token, in epoch time
    expirationTimestamp?: number;
}>;
