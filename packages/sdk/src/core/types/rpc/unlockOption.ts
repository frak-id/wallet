import type { Hex } from "viem";

/**
 * The response to the get unlock options response
 */
export type UnlockOptionsReturnType = Readonly<{
    // The current user frk balance in wei
    frkBalanceAsHex?: Hex;

    // The prices to unlock the article
    prices: {
        // The price index
        index: number;
        // The unlock duration of this price
        unlockDurationInSec: number;
        // The frk amount of the price (bigint as Hex)
        frkAmount: Hex;
        // Boolean to know if the prices are accessible for the user or not
        // Can be null if user not logged in
        isUserAccessible: boolean | null;
    }[];
}>;
