import { currentStablecoins, type Stablecoin } from "@frak-labs/app-essentials";
import type { Address } from "viem";

/** Reverse lookup of `currentStablecoins`: token address → stablecoin key. */
export function detectStablecoinFromAddress(
    address: Address
): Stablecoin | undefined {
    for (const [key, value] of Object.entries(currentStablecoins)) {
        if (value.toLowerCase() === address.toLowerCase()) {
            return key as Stablecoin;
        }
    }
    return undefined;
}
